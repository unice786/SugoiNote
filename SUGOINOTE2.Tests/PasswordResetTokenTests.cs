using SugoiNote.Models;

namespace SUGOINOTE2.Tests;

/// <summary>Pruebas de la regla de validez del token de restablecimiento de contraseña.</summary>
public class PasswordResetTokenTests
{
    [Fact]
    public void EsValido_VerdaderoSiNoSeUsoYNoHaExpirado()
    {
        var token = new PasswordResetToken { ExpiraUtc = DateTime.UtcNow.AddMinutes(30) };

        Assert.True(token.EsValido);
    }

    [Fact]
    public void EsValido_FalsoSiYaSeUso()
    {
        var token = new PasswordResetToken
        {
            ExpiraUtc = DateTime.UtcNow.AddMinutes(30),
            UsadoUtc = DateTime.UtcNow,
        };

        Assert.False(token.EsValido);
    }

    [Fact]
    public void EsValido_FalsoSiYaExpiro()
    {
        var token = new PasswordResetToken { ExpiraUtc = DateTime.UtcNow.AddMinutes(-1) };

        Assert.False(token.EsValido);
    }

    [Fact]
    public void TokenId_SeGeneraPorDefecto()
    {
        Assert.NotEqual(Guid.Empty, new PasswordResetToken().TokenId);
    }
}
