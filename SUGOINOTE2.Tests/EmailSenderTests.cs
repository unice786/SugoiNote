using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del envio de correo. En modo SoloLog no debe tocar la red y debe
/// devolver true; con un SMTP inalcanzable debe devolver false sin propagar la
/// excepcion (un fallo de correo no puede romper el flujo de la app).
/// </summary>
public class EmailSenderTests
{
    private static EmailSender Crear(EmailOptions opciones) =>
        new(Datos.Opciones(opciones), NullLogger<EmailSender>.Instance);

    [Fact]
    public async Task Enviar_ModoSoloLog_DevuelveTrue()
    {
        var sender = Crear(new EmailOptions { SoloLog = true, Host = "smtp.invalido" });

        Assert.True(await sender.EnviarAsync("ana@correo.com", "Bienvenida", "<p>Hola</p>"));
    }

    [Fact]
    public async Task Enviar_SinHost_DevuelveTruePorqueSoloRegistra()
    {
        var sender = Crear(new EmailOptions { SoloLog = false, Host = "   " });

        Assert.True(await sender.EnviarAsync("ana@correo.com", "Bienvenida", "<p>Hola</p>"));
    }

    [Fact]
    public async Task Enviar_SmtpInalcanzable_DevuelveFalseSinLanzar()
    {
        // Puerto 1 en localhost: la conexion se rechaza de inmediato, sin red externa.
        var sender = Crear(new EmailOptions
        {
            SoloLog = false,
            Host = "127.0.0.1",
            Port = 1,
            Remitente = "no-reply@sugoinote.local",
            Ssl = false,
        });

        Assert.False(await sender.EnviarAsync("ana@correo.com", "Bienvenida", "<p>Hola</p>"));
    }
}
