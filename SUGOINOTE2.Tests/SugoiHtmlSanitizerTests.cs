using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del saneador de HTML. Es la defensa contra XSS del contenido del editor y de la IA.
/// </summary>
public class SugoiHtmlSanitizerTests
{
    private readonly SugoiHtmlSanitizer _sanitizer = new();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Sanitize_Vacio_DevuelveCadenaVacia(string? html)
        => Assert.Equal(string.Empty, _sanitizer.Sanitize(html));

    [Fact]
    public void Sanitize_EliminaLaEtiquetaScript()
    {
        var salida = _sanitizer.Sanitize("<p>ok</p><script>alert('xss')</script>");

        Assert.Contains("ok", salida);
        Assert.DoesNotContain("<script", salida, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sanitize_EliminaElAtributoOnerror()
    {
        var salida = _sanitizer.Sanitize("<img src=\"x\" onerror=\"alert(1)\">");

        Assert.DoesNotContain("onerror", salida, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sanitize_EliminaHrefJavascript()
    {
        var salida = _sanitizer.Sanitize("<a href=\"javascript:alert(1)\">link</a>");

        Assert.DoesNotContain("javascript:", salida, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sanitize_ConservaElFormatoDelEditor()
    {
        var salida = _sanitizer.Sanitize(
            "<h2>Título</h2><p><strong>negrita</strong></p><ul><li>uno</li></ul><code>x=1</code>");

        Assert.Contains("<h2", salida);
        Assert.Contains("<strong>", salida);
        Assert.Contains("<li>", salida);
        Assert.Contains("<code>", salida);
    }

    [Fact]
    public void Sanitize_ConservaLasTablas()
    {
        var salida = _sanitizer.Sanitize("<table><tr><td>celda</td></tr></table>");

        Assert.Contains("<table>", salida);
        Assert.Contains("<td>", salida);
    }

    [Fact]
    public void Sanitize_QuitaTargetDeLosEnlaces()
    {
        var salida = _sanitizer.Sanitize("<a href=\"https://x.com\" target=\"_blank\">x</a>");

        Assert.DoesNotContain("target", salida, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sanitize_ConservaLaImagenDataUri()
    {
        var salida = _sanitizer.Sanitize("<img src=\"data:image/png;base64,iVBORw0KGgo=\">");

        Assert.Contains("data:image/png;base64", salida);
    }

    [Theory]
    [InlineData("https://ejemplo.com")]
    [InlineData("http://ejemplo.com/a?b=1")]
    [InlineData("data:image/png;base64,iVBORw0KGgo=")]
    [InlineData("data:image/jpeg;base64,AAAA")]
    public void EsUrlSegura_AceptaUrlConOrigenDeRedOImagenEmbebida(string url)
        => Assert.True(_sanitizer.EsUrlSegura(url));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("javascript:alert(1)")]
    [InlineData("vbscript:msgbox(1)")]
    [InlineData("data:text/html;base64,PHNjcmlwdD4=")]
    [InlineData("data:image/svg+xml;base64,PHN2Zz4=")]
    [InlineData("file:///C:/x.txt")]
    [InlineData("/ruta/relativa")]
    public void EsUrlSegura_RechazaEsquemasPeligrososORelativos(string? url)
        => Assert.False(_sanitizer.EsUrlSegura(url));

    [Fact]
    public void SanitizeUrl_DevuelveNullSiNoEsSegura()
        => Assert.Null(_sanitizer.SanitizeUrl("javascript:alert(1)"));

    [Fact]
    public void SanitizeUrl_DevuelveLaUrlRecortadaSiEsSegura()
        => Assert.Equal("https://x.com", _sanitizer.SanitizeUrl("  https://x.com  "));
}
