using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>Pruebas del servicio de autenticación: registro, login, bloqueo y recuperación.</summary>
public class AuthServiceTests
{
    private static AuthService Crear(Sugoinotee2Context db, FakeEmailSender? email = null, bool soloLog = true) =>
        new(db, email ?? new FakeEmailSender(),
            Datos.Opciones(new EmailOptions { SoloLog = soloLog }),
            NullLogger<AuthService>.Instance);

    private static async Task<Estudiante> SembrarEstudiante(
        Sugoinotee2Context db, string clave = "Clave123", int fallos = 0, DateTime? lockout = null)
    {
        var estudiante = Datos.Estudiante(clave: clave);
        estudiante.FailedLoginCount = fallos;
        estudiante.LockoutEndUtc = lockout;
        db.Estudiantes.Add(estudiante);
        await db.SaveChangesAsync();
        return estudiante;
    }

    private static async Task<PasswordResetToken> SembrarToken(Sugoinotee2Context db, Guid estudianteId, string token,
        DateTime expira, DateTime? usado = null)
    {
        var entidad = new PasswordResetToken
        {
            EstudianteId = estudianteId,
            TokenHash = AuthService.HashToken(token),
            ExpiraUtc = expira,
            UsadoUtc = usado,
        };

        db.PasswordResetTokens.Add(entidad);
        await db.SaveChangesAsync();
        return entidad;
    }

    // ── Registro ───────────────────────────────────────────────

    [Fact]
    public async Task Registrar_NombreCorto_DevuelveDatosInvalidos()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RegistrarAsync("A", "a@b.com", "Clave123");

        Assert.Equal(ResultadoAuth.DatosInvalidos, r.Estado);
    }

    [Fact]
    public async Task Registrar_NombreLargo_DevuelveDatosInvalidos()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RegistrarAsync(new string('a', 151), "a@b.com", "Clave123");

        Assert.Equal(ResultadoAuth.DatosInvalidos, r.Estado);
    }

    [Fact]
    public async Task Registrar_CorreoInvalido_DevuelveDatosInvalidos()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RegistrarAsync("Ana", "noesemail", "Clave123");

        Assert.Equal(ResultadoAuth.DatosInvalidos, r.Estado);
    }

    [Theory]
    [InlineData("Corta1")]
    [InlineData("sindigitos")]
    [InlineData("12345678")]
    public async Task Registrar_ClaveDebil_DevuelveDatosInvalidos(string clave)
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RegistrarAsync("Ana", "a@b.com", clave);

        Assert.Equal(ResultadoAuth.DatosInvalidos, r.Estado);
    }

    [Fact]
    public async Task Registrar_Ok_GuardaHashYNormalizaElCorreo()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RegistrarAsync("Ana", "ANA@Correo.COM", "Clave123");

        Assert.True(r.Exito);
        var guardado = t.Context.Estudiantes.Single();
        Assert.Equal("ana@correo.com", guardado.CorreoElectronico);
        Assert.StartsWith("$2", guardado.ClaveAcceso);
    }

    [Fact]
    public async Task Registrar_CorreoDuplicado_DevuelveEmailEnUso()
    {
        using var t = new TestDb();
        t.Context.Estudiantes.Add(Datos.Estudiante(correo: "ana@correo.com"));
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).RegistrarAsync("Otra", "ana@correo.com", "Clave123");

        Assert.Equal(ResultadoAuth.EmailEnUso, r.Estado);
    }

    // ── Login ──────────────────────────────────────────────────

    [Fact]
    public async Task Login_UsuarioInexistente_DevuelveCredencialesInvalidas()
    {
        using var t = new TestDb();

        var (r, estudiante) = await Crear(t.Context).ValidarCredencialesAsync("nadie@correo.com", "Clave123");

        Assert.Equal(ResultadoAuth.CredencialesInvalidas, r.Estado);
        Assert.Null(estudiante);
    }

    [Fact]
    public async Task Login_ClaveIncorrecta_IncrementaElContadorDeIntentos()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);

        var (r, _) = await Crear(t.Context).ValidarCredencialesAsync(e.CorreoElectronico, "OtraClave1");

        Assert.Equal(ResultadoAuth.CredencialesInvalidas, r.Estado);
        Assert.Equal(1, (await t.Context.Estudiantes.FindAsync(e.EstudianteId))!.FailedLoginCount);
    }

    [Fact]
    public async Task Login_CincoFallos_BloqueaLaCuenta()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context, fallos: 4);

        var (r, _) = await Crear(t.Context).ValidarCredencialesAsync(e.CorreoElectronico, "OtraClave1");

        Assert.Equal(ResultadoAuth.CuentaBloqueada, r.Estado);
        var actualizado = await t.Context.Estudiantes.FindAsync(e.EstudianteId);
        Assert.NotNull(actualizado!.LockoutEndUtc);
        Assert.Equal(0, actualizado.FailedLoginCount);
    }

    [Fact]
    public async Task Login_CuentaBloqueada_DevuelveCuentaBloqueada()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context, lockout: DateTime.UtcNow.AddMinutes(5));

        var (r, _) = await Crear(t.Context).ValidarCredencialesAsync(e.CorreoElectronico, "Clave123");

        Assert.Equal(ResultadoAuth.CuentaBloqueada, r.Estado);
    }

    [Fact]
    public async Task Login_Ok_ReseteaLosContadores()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context, fallos: 2, lockout: DateTime.UtcNow.AddMinutes(-1));

        var (r, estudiante) = await Crear(t.Context).ValidarCredencialesAsync(e.CorreoElectronico, "Clave123");

        Assert.True(r.Exito);
        Assert.NotNull(estudiante);
        Assert.Equal(0, estudiante!.FailedLoginCount);
        Assert.Null(estudiante.LockoutEndUtc);
    }

    // ── Recuperación de contraseña ─────────────────────────────

    [Fact]
    public async Task SolicitarReset_CorreoInvalido_RespuestaGenericaSinToken()
    {
        using var t = new TestDb();

        var (ok, _, token) = await Crear(t.Context).SolicitarResetAsync("noesemail");

        Assert.True(ok);
        Assert.Null(token);
    }

    [Fact]
    public async Task SolicitarReset_CorreoDesconocido_NoCreaTokens()
    {
        using var t = new TestDb();

        var (ok, _, token) = await Crear(t.Context).SolicitarResetAsync("nadie@correo.com");

        Assert.True(ok);
        Assert.Null(token);
        Assert.Empty(t.Context.PasswordResetTokens);
    }

    [Fact]
    public async Task SolicitarReset_Ok_CreaElTokenYLoDevuelveEnModoLog()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);

        var (ok, _, token) = await Crear(t.Context, soloLog: true).SolicitarResetAsync(e.CorreoElectronico);

        Assert.True(ok);
        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.Single(t.Context.PasswordResetTokens);
    }

    [Fact]
    public async Task SolicitarReset_InvalidaLosTokensAnteriores()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);
        var viejo = await SembrarToken(t.Context, e.EstudianteId, "viejo", DateTime.UtcNow.AddMinutes(30));

        await Crear(t.Context).SolicitarResetAsync(e.CorreoElectronico);

        Assert.NotNull(viejo.UsadoUtc);
        Assert.Equal(2, t.Context.PasswordResetTokens.Count());
    }

    [Fact]
    public async Task SolicitarReset_SinModoLog_NoDevuelveElToken()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);

        var (_, _, token) = await Crear(t.Context, soloLog: false).SolicitarResetAsync(e.CorreoElectronico);

        Assert.Null(token);
        Assert.Single(t.Context.PasswordResetTokens);
    }

    [Fact]
    public async Task Restablecer_TokenVacio_DevuelveTokenInvalido()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RestablecerConTokenAsync("", "Clave123");

        Assert.Equal(ResultadoAuth.TokenInvalido, r.Estado);
    }

    [Fact]
    public async Task Restablecer_ClaveDebil_DevuelveDatosInvalidos()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RestablecerConTokenAsync("cualquiera", "corta");

        Assert.Equal(ResultadoAuth.DatosInvalidos, r.Estado);
    }

    [Fact]
    public async Task Restablecer_TokenDesconocido_DevuelveTokenInvalido()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).RestablecerConTokenAsync("no-existe", "Clave123");

        Assert.Equal(ResultadoAuth.TokenInvalido, r.Estado);
    }

    [Fact]
    public async Task Restablecer_TokenExpirado_DevuelveTokenInvalido()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);
        await SembrarToken(t.Context, e.EstudianteId, "tok", DateTime.UtcNow.AddMinutes(-1));

        var r = await Crear(t.Context).RestablecerConTokenAsync("tok", "Clave123");

        Assert.Equal(ResultadoAuth.TokenInvalido, r.Estado);
    }

    [Fact]
    public async Task Restablecer_TokenYaUsado_DevuelveTokenInvalido()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context);
        await SembrarToken(t.Context, e.EstudianteId, "tok", DateTime.UtcNow.AddMinutes(30), usado: DateTime.UtcNow);

        var r = await Crear(t.Context).RestablecerConTokenAsync("tok", "Clave123");

        Assert.Equal(ResultadoAuth.TokenInvalido, r.Estado);
    }

    [Fact]
    public async Task Restablecer_TokenValido_CambiaLaClaveYMarcaUsado()
    {
        using var t = new TestDb();
        var e = await SembrarEstudiante(t.Context, clave: "Vieja123");
        var hashPrevio = e.ClaveAcceso;
        var selloPrevio = e.SecurityStamp;
        await SembrarToken(t.Context, e.EstudianteId, "tok", DateTime.UtcNow.AddMinutes(30));

        var r = await Crear(t.Context).RestablecerConTokenAsync("tok", "Nueva123");

        Assert.True(r.Exito);
        var actualizado = await t.Context.Estudiantes.FindAsync(e.EstudianteId);
        Assert.NotEqual(hashPrevio, actualizado!.ClaveAcceso);
        Assert.NotEqual(selloPrevio, actualizado.SecurityStamp);
        Assert.All(t.Context.PasswordResetTokens.ToList(), tok => Assert.NotNull(tok.UsadoUtc));
    }
}
