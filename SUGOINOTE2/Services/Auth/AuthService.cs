using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Auth;

public enum ResultadoAuth
{
    Exito,
    CredencialesInvalidas,
    CuentaBloqueada,
    EmailEnUso,
    EmailNoEncontrado,
    TokenInvalido,
    DatosInvalidos,
}

public record AuthResult(ResultadoAuth Estado, string? Error = null, bool Exito = false);

public interface IAuthService
{
    Task<AuthResult> RegistrarAsync(string nombre, string correo, string clave, CancellationToken ct = default);

    Task<(AuthResult Resultado, Estudiante? Estudiante)> ValidarCredencialesAsync(string correo, string clave, CancellationToken ct = default);

    /// <summary>
    /// Siempre devuelve Exito con el mismo mensaje, exista o no la cuenta: evita enumerar usuarios.
    /// En modo desarrollo (Email SoloLog) devuelve ademas el token para poder verlo en consola.
    /// </summary>
    Task<(bool Ok, string Mensaje, string? TokenDesarrollo)> SolicitarResetAsync(string correo, CancellationToken ct = default);

    Task<AuthResult> RestablecerConTokenAsync(string token, string nuevaClave, CancellationToken ct = default);
}

public class AuthService(
    Sugoinotee2Context db,
    IEmailSender email,
    IOptions<EmailOptions> emailOptions,
    ILogger<AuthService> logger) : IAuthService
{
    private const int MaxIntentos = 5;
    private static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan ValidezToken = TimeSpan.FromMinutes(30);

    private bool EmailEnModoLog => emailOptions.Value.SoloLog || string.IsNullOrWhiteSpace(emailOptions.Value.Host);

    // ── Registro ───────────────────────────────────────────────

    public async Task<AuthResult> RegistrarAsync(string nombre, string correo, string clave, CancellationToken ct = default)
    {
        var n = (nombre ?? string.Empty).Trim();
        var c = (correo ?? string.Empty).Trim().ToLowerInvariant();

        if (n.Length < 2) return new(ResultadoAuth.DatosInvalidos, "El nombre debe tener al menos 2 caracteres.");
        if (n.Length > 150) return new(ResultadoAuth.DatosInvalidos, "El nombre no puede superar los 150 caracteres.");
        if (!EmailValido(c)) return new(ResultadoAuth.DatosInvalidos, "El correo no tiene un formato válido.");

        var (claveOk, errorClave) = ValidarClave(clave);
        if (!claveOk) return new(ResultadoAuth.DatosInvalidos, errorClave);

        if (await db.Estudiantes.AnyAsync(e => e.CorreoElectronico == c, ct))
            return new(ResultadoAuth.EmailEnUso, "Ese correo ya está registrado.");

        var estudiante = new Estudiante
        {
            EstudianteId = Guid.NewGuid(),
            NombreCompleto = n,
            CorreoElectronico = c,
            ClaveAcceso = BCrypt.Net.BCrypt.HashPassword(clave, workFactor: 12),
            FechaCreacion = DateTime.UtcNow,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            FailedLoginCount = 0,
        };

        db.Estudiantes.Add(estudiante);

        try
        {
            await db.SaveChangesAsync(ct);
            return new(ResultadoAuth.Exito, null, true);
        }
        catch (DbUpdateException ex)
        {
            // Carrera entre dos registros simultaneos con el mismo correo.
            logger.LogWarning(ex, "Choque de correo unico al registrar {Correo}", c);
            return new(ResultadoAuth.EmailEnUso, "Ese correo ya está registrado.");
        }
    }

    // ── Login ───────────────────────────────────────────────────

    public async Task<(AuthResult, Estudiante?)> ValidarCredencialesAsync(string correo, string clave, CancellationToken ct = default)
    {
        var c = (correo ?? string.Empty).Trim().ToLowerInvariant();
        var k = clave ?? string.Empty;

        var estudiante = await db.Estudiantes.FirstOrDefaultAsync(e => e.CorreoElectronico == c, ct);

        // Comparación con hash señuelo cuando el usuario no existe, para que el tiempo de
        // respuesta no revele si el correo está registrado.
        if (estudiante is null)
        {
            BCrypt.Net.BCrypt.Verify(k, HashFicticio);
            return (new AuthResult(ResultadoAuth.CredencialesInvalidas, "Correo o contraseña incorrectos."), null);
        }

        if (estudiante.LockoutEndUtc is not null && estudiante.LockoutEndUtc > DateTime.UtcNow)
        {
            var minutos = Math.Max(1, (int)Math.Ceiling((estudiante.LockoutEndUtc.Value - DateTime.UtcNow).TotalMinutes));
            return (new AuthResult(ResultadoAuth.CuentaBloqueada,
                $"Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo en {minutos} minuto(s)."), null);
        }

        bool correcta;
        try
        {
            correcta = !string.IsNullOrEmpty(estudiante.ClaveAcceso)
                       && estudiante.ClaveAcceso.StartsWith("$2", StringComparison.Ordinal)
                       && BCrypt.Net.BCrypt.Verify(k, estudiante.ClaveAcceso);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // FIX C1: antes una fila con hash corrupto caia al fallback de texto plano.
            logger.LogError("Hash bcrypt corrupto para el estudiante {EstudianteId}", estudiante.EstudianteId);
            return (new AuthResult(ResultadoAuth.CredencialesInvalidas, "Correo o contraseña incorrectos."), null);
        }

        if (!correcta)
        {
            estudiante.FailedLoginCount++;

            if (estudiante.FailedLoginCount >= MaxIntentos)
            {
                estudiante.LockoutEndUtc = DateTime.UtcNow.Add(Bloqueo);
                estudiante.FailedLoginCount = 0;
                await db.SaveChangesAsync(ct);

                return (new AuthResult(ResultadoAuth.CuentaBloqueada,
                    $"Demasiados intentos fallidos. Cuenta bloqueada durante {Bloqueo.TotalMinutes:0} minutos."), null);
            }

            await db.SaveChangesAsync(ct);
            return (new AuthResult(ResultadoAuth.CredencialesInvalidas, "Correo o contraseña incorrectos."), null);
        }

        if (estudiante.FailedLoginCount > 0 || estudiante.LockoutEndUtc is not null)
        {
            estudiante.FailedLoginCount = 0;
            estudiante.LockoutEndUtc = null;
            await db.SaveChangesAsync(ct);
        }

        return (new AuthResult(ResultadoAuth.Exito, null, true), estudiante);
    }

    // ── Recuperación de contraseña ─────────────────────────────

    public async Task<(bool Ok, string Mensaje, string? TokenDesarrollo)> SolicitarResetAsync(string correo, CancellationToken ct = default)
    {
        const string mensajeGenerico =
            "Si ese correo tiene una cuenta, te enviamos un enlace para restablecer tu contraseña.";

        var c = (correo ?? string.Empty).Trim().ToLowerInvariant();
        if (!EmailValido(c)) return (true, mensajeGenerico, null);

        var estudiante = await db.Estudiantes.FirstOrDefaultAsync(e => e.CorreoElectronico == c, ct);
        if (estudiante is null)
        {
            // Respuesta identica para no confirmar si la cuenta existe.
            return (true, mensajeGenerico, null);
        }

        // Invalidar tokens anteriores vivos.
        var previos = await db.PasswordResetTokens
            .Where(t => t.EstudianteId == estudiante.EstudianteId && t.UsadoUtc == null)
            .ToListAsync(ct);

        foreach (var p in previos) p.UsadoUtc = DateTime.UtcNow;

        var tokenClaro = GenerarToken();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            TokenId = Guid.NewGuid(),
            EstudianteId = estudiante.EstudianteId,
            TokenHash = HashToken(tokenClaro),
            CreadoUtc = DateTime.UtcNow,
            ExpiraUtc = DateTime.UtcNow.Add(ValidezToken),
        });

        await db.SaveChangesAsync(ct);

        var enlace = $"{ResetBaseUrl(tokenClaro)}";

        var enviado = await email.EnviarAsync(c, "Restablecer tu contraseña - SugoiNote", $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
              <h2 style="color:#7c3aed">SugoiNote</h2>
              <p>Hola {System.Net.WebUtility.HtmlEncode(estudiante.NombreCompleto)},</p>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
              <p style="margin:24px 0">
                <a href="{enlace}" style="background:#7c3aed;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;display:inline-block">
                  Restablecer contraseña
                </a>
              </p>
              <p style="font-size:13px;color:#6b7280">
                El enlace expira en {ValidezToken.TotalMinutes:0} minutos y solo puede usarse una vez.
                Si no fuiste tú, puedes ignorar este mensaje.
              </p>
            </div>
            """, ct);

        if (!enviado)
        {
            logger.LogError("No se pudo enviar el email de recuperacion a {Correo}", c);
        }

        // Solo en desarrollo devolvemos el token para poder completar la prueba sin SMTP.
        return (true, mensajeGenerico, EmailEnModoLog ? tokenClaro : null);
    }

    public async Task<AuthResult> RestablecerConTokenAsync(string token, string nuevaClave, CancellationToken ct = default)
    {
        var t = (token ?? string.Empty).Trim();
        if (t.Length == 0) return new(ResultadoAuth.TokenInvalido, "El enlace no es válido.");

        var (claveOk, errorClave) = ValidarClave(nuevaClave);
        if (!claveOk) return new(ResultadoAuth.DatosInvalidos, errorClave);

        var registro = await db.PasswordResetTokens
            .Include(x => x.Estudiante)
            .FirstOrDefaultAsync(x => x.TokenHash == HashToken(t), ct);

        if (registro is null || registro.Estudiante is null || !registro.EsValido)
            return new(ResultadoAuth.TokenInvalido, "El enlace no es válido o ya expiró.");

        registro.UsadoUtc = DateTime.UtcNow;

        var estudiante = registro.Estudiante;
        estudiante.ClaveAcceso = BCrypt.Net.BCrypt.HashPassword(nuevaClave, workFactor: 12);
        estudiante.SecurityStamp = Guid.NewGuid().ToString("N");
        estudiante.FailedLoginCount = 0;
        estudiante.LockoutEndUtc = null;

        await db.SaveChangesAsync(ct);
        return new(ResultadoAuth.Exito, null, true);
    }

    // ── Utilidades ─────────────────────────────────────────────

    private static string ResetBaseUrl(string token) =>
        $"{Configuracion.UrlBase}/Auth/Restablecer?token={Uri.EscapeDataString(token)}";

    internal static string GenerarToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    internal static string HashToken(string token) =>
        Convert.ToBase64String(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    /// <summary>Hash válido y fijo, usado solo para igualar el tiempo de respuesta del login.</summary>
    private const string HashFicticio = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.5YQvJfGfEXvGWGmZLxHXKq0q0K0K0K0";

    private static (bool Ok, string? Error) ValidarClave(string clave)
    {
        var k = clave ?? string.Empty;

        if (k.Length < 8) return (false, "La contraseña debe tener al menos 8 caracteres.");
        if (k.Length > 72) return (false, "La contraseña no puede superar los 72 caracteres.");
        if (!k.Any(char.IsLetter)) return (false, "La contraseña debe incluir al menos una letra.");
        if (!k.Any(char.IsDigit)) return (false, "La contraseña debe incluir al menos un número.");

        return (true, null);
    }

    internal static bool EmailValido(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 150) return false;

        var arroba = email.IndexOf('@');
        if (arroba <= 0 || arroba != email.LastIndexOf('@') || arroba == email.Length - 1) return false;

        var dominio = email[(arroba + 1)..];
        var punto = dominio.IndexOf('.');

        return punto > 0 && punto < dominio.Length - 1
               && !email.Any(char.IsWhiteSpace)
               && !dominio.StartsWith('.') && !dominio.EndsWith('.');
    }
}

/// <summary>Valores de URL leidos de configuracion (inyectados por registro en Program.cs).</summary>
public static class Configuracion
{
    public static string UrlBase { get; set; } = "https://localhost:7244";
}