using SugoiNote.Services.Auth;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas de los ayudantes internos de <c>AuthService</c> (validación de correo, generación
/// y hash del token de recuperación). Se accede a ellos gracias a InternalsVisibleTo.
/// </summary>
public class AuthHelpersTests
{
    [Theory]
    [InlineData("a@b.com")]
    [InlineData("usuario.apellido@dominio.com.co")]
    [InlineData("u+etiqueta@dominio.org")]
    public void EmailValido_AceptaCorreosBienFormados(string correo)
        => Assert.True(AuthService.EmailValido(correo));

    [Theory]
    [InlineData("")]
    [InlineData("sinarroba")]
    [InlineData("dos@@dominio.com")]
    [InlineData("a@dominio")]
    [InlineData("a@dominio.")]
    [InlineData("a@.com")]
    [InlineData("a b@dominio.com")]
    [InlineData("@dominio.com")]
    [InlineData("a@dominio.com ")]
    public void EmailValido_RechazaCorreosMalFormados(string correo)
        => Assert.False(AuthService.EmailValido(correo));

    [Fact]
    public void EmailValido_RechazaMasDe150Caracteres()
        => Assert.False(AuthService.EmailValido(new string('a', 145) + "@x.com"));

    [Fact]
    public void GenerarToken_EsUrlSafe()
    {
        var token = AuthService.GenerarToken();

        Assert.False(string.IsNullOrWhiteSpace(token));
        Assert.DoesNotContain('+', token);
        Assert.DoesNotContain('/', token);
        Assert.DoesNotContain('=', token);
    }

    [Fact]
    public void GenerarToken_EsUnicoEnCadaLlamada()
        => Assert.NotEqual(AuthService.GenerarToken(), AuthService.GenerarToken());

    [Fact]
    public void HashToken_EsDeterminista()
        => Assert.Equal(AuthService.HashToken("abc"), AuthService.HashToken("abc"));

    [Fact]
    public void HashToken_CambiaConLaEntrada()
        => Assert.NotEqual(AuthService.HashToken("abc"), AuthService.HashToken("abd"));

    [Fact]
    public void HashToken_TieneLaLongitudBase64DeSha256()
        => Assert.Equal(44, AuthService.HashToken("abc").Length);
}
