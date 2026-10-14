using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Auth;

public interface IEmailSender
{
    /// <summary>Devuelve true si el email se envió (o se registró en modo SoloLog).</summary>
    Task<bool> EnviarAsync(string destinatario, string asunto, string cuerpoHtml, CancellationToken ct = default);
}

public class EmailSender(IOptions<EmailOptions> options, ILogger<EmailSender> logger) : IEmailSender
{
    private readonly EmailOptions _opt = options.Value;

    public async Task<bool> EnviarAsync(string destinatario, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        if (_opt.SoloLog || string.IsNullOrWhiteSpace(_opt.Host))
        {
            // Modo desarrollo: se escribe el enlace en el log para poder usarlo sin configurar SMTP.
            logger.LogInformation(
                "EMAIL (SoloLog) -> {Destinatario} | {Asunto}\n{Cuerpo}", destinatario, asunto, cuerpoHtml);
            return true;
        }

        try
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(new MailboxAddress("SugoiNote", _opt.Remitente));
            mensaje.To.Add(MailboxAddress.Parse(destinatario));
            mensaje.Subject = asunto;
            mensaje.Body = new BodyBuilder { HtmlBody = cuerpoHtml }.ToMessageBody();

            using var cliente = new SmtpClient();
            var seguridad = _opt.Ssl ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;

            await cliente.ConnectAsync(_opt.Host, _opt.Port, seguridad, ct);

            if (!string.IsNullOrWhiteSpace(_opt.User))
                await cliente.AuthenticateAsync(_opt.User, _opt.Password, ct);

            await cliente.SendAsync(mensaje, ct);
            await cliente.DisconnectAsync(true, ct);

            logger.LogInformation("Email enviado a {Destinatario}: {Asunto}", destinatario, asunto);
            return true;
        }
        catch (Exception ex)
        {
            // Un fallo de SMTP nunca debe revelar si la cuenta existe ni romper el flujo.
            logger.LogError(ex, "No se pudo enviar el email a {Destinatario}", destinatario);
            return false;
        }
    }
}