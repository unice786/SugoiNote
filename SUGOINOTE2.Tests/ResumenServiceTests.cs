using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Common;
using SugoiNote.Services.Ia;
using SugoiNote.Services.Resumenes;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del servicio de resúmenes con IA. Se usa un cliente de IA falso y el saneador real,
/// y se comprueba la regla clave: un fallo de la IA NUNCA debe persistirse como resumen.
/// </summary>
public class ResumenServiceTests
{
    private static ResumenService Crear(Sugoinotee2Context db, FakeIaClient ia) =>
        new(db, ia, new SugoiHtmlSanitizer(), NullLogger<ResumenService>.Instance);

    private static async Task<Apunte> SembrarApunte(Sugoinotee2Context db, Guid estudianteId,
        string contenido = "<p>Contenido del apunte</p>")
    {
        var apunte = Datos.Apunte(estudianteId, contenido: contenido);
        db.Apuntes.Add(apunte);
        await db.SaveChangesAsync();
        return apunte;
    }

    [Fact]
    public async Task Generar_ApunteInexistente_DevuelveError()
    {
        using var t = new TestDb();

        var (ok, _, error) = await Crear(t.Context, new FakeIaClient())
            .GenerarAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Generar_ApunteDeOtroDueno_DevuelveError()
    {
        using var t = new TestDb();
        var apunte = await SembrarApunte(t.Context, Guid.NewGuid());

        var (ok, _, _) = await Crear(t.Context, new FakeIaClient())
            .GenerarAsync(apunte.ApunteId, Guid.NewGuid());

        Assert.False(ok);
    }

    [Fact]
    public async Task Generar_ApunteVacio_DevuelveError()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo, contenido: "<p>   </p>");

        var (ok, _, error) = await Crear(t.Context, new FakeIaClient()).GenerarAsync(apunte.ApunteId, yo);

        Assert.False(ok);
        Assert.Contains("vacío", error!);
    }

    [Fact]
    public async Task Generar_FalloDeIa_NoPersisteNada()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Excepcion = new IaException("límite alcanzado") };

        var (ok, _, error) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo);

        Assert.False(ok);
        Assert.Equal("límite alcanzado", error);
        Assert.Null((await t.Context.Apuntes.FindAsync(apunte.ApunteId))!.ResumenGeneradoIA);
    }

    [Fact]
    public async Task Generar_Ok_PersisteElResumenSanitizado()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Texto = (_, _) => "<h2>Tema</h2><p>Resumen</p>" };

        var (ok, html, error) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo);

        Assert.True(ok);
        Assert.Null(error);
        Assert.Contains("<h2>", html);
        Assert.Equal(html, (await t.Context.Apuntes.FindAsync(apunte.ApunteId))!.ResumenGeneradoIA);
    }

    [Fact]
    public async Task Generar_QuitaElBloqueHtmlQueAvecesAnadeLaIa()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Texto = (_, _) => "```html\n<h2>Ok</h2>\n```" };

        var (ok, html, _) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo);

        Assert.True(ok);
        Assert.DoesNotContain("```", html);
        Assert.Contains("<h2>", html);
    }

    [Fact]
    public async Task Generar_EliminaScriptsDelResumen()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Texto = (_, _) => "<p>ok</p><script>alert(1)</script>" };

        var (ok, html, _) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo);

        Assert.True(ok);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Generar_ResumenVacioTrasSanear_DevuelveError()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Texto = (_, _) => "   " };

        var (ok, _, error) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo);

        Assert.False(ok);
        Assert.Contains("vacío", error!);
        Assert.Null((await t.Context.Apuntes.FindAsync(apunte.ApunteId))!.ResumenGeneradoIA);
    }

    [Fact]
    public async Task Obtener_RespetaElPropietario()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = Datos.Apunte(yo);
        apunte.ResumenGeneradoIA = "<p>r</p>";
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();
        var servicio = Crear(t.Context, new FakeIaClient());

        Assert.Equal("<p>r</p>", await servicio.ObtenerAsync(apunte.ApunteId, yo));
        Assert.Null(await servicio.ObtenerAsync(apunte.ApunteId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Listar_MarcaSiTieneResumen()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var con = Datos.Apunte(yo, "Con");
        con.ResumenGeneradoIA = "<p>r</p>";
        t.Context.Apuntes.AddRange(con, Datos.Apunte(yo, "Sin"));
        await t.Context.SaveChangesAsync();

        var lista = await Crear(t.Context, new FakeIaClient()).ListarAsync(yo);

        Assert.True(lista.Single(x => x.Item2 == "Con").Item4);
        Assert.False(lista.Single(x => x.Item2 == "Sin").Item4);
    }

    [Theory]
    [InlineData("<p>Hola <strong>mundo</strong></p>", "Hola mundo")]
    [InlineData("<script>alert(1)</script><p>texto</p>", "texto")]
    [InlineData("<div>&amp; &lt;x&gt;</div>", "& <x>")]
    public void ExtraerTexto_LimpiaElHtml(string html, string esperado)
        => Assert.Equal(esperado, ResumenService.ExtraerTexto(html));
}
