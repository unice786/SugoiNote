using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del servicio de apuntes. Se usa el saneador real para verificar de punta a punta
/// que el contenido se guarda limpio (regresión del fallo de XSS en el alta rápida).
/// </summary>
public class ApunteServiceTests
{
    private static ApunteService Crear(Sugoinotee2Context db) =>
        new(db, new SugoiHtmlSanitizer(), NullLogger<ApunteService>.Instance);

    [Fact]
    public async Task CrearRapido_SinTitulo_DevuelveFallo()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearRapidoAsync(
            new Apunte { TituloNota = "  ", EstudianteId = Guid.NewGuid() });

        Assert.False(r.Ok);
    }

    [Fact]
    public async Task CrearRapido_SaneaElHtmlDelContenido()
    {
        using var t = new TestDb();
        var apunte = new Apunte
        {
            TituloNota = "Nota",
            EstudianteId = Guid.NewGuid(),
            ContenidoTexto = "<p>ok</p><script>alert(1)</script><img src=x onerror=alert(2)>",
        };

        var r = await Crear(t.Context).CrearRapidoAsync(apunte);

        Assert.True(r.Ok);
        var guardado = t.Context.Apuntes.Single();
        Assert.DoesNotContain("<script", guardado.ContenidoTexto, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onerror", guardado.ContenidoTexto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CrearRapido_RecortaElTituloLargo()
    {
        using var t = new TestDb();

        await Crear(t.Context).CrearRapidoAsync(
            new Apunte { TituloNota = new string('a', 250), EstudianteId = Guid.NewGuid() });

        Assert.Equal(200, t.Context.Apuntes.Single().TituloNota.Length);
    }

    [Fact]
    public async Task CrearRapido_AsignaIdYFecha()
    {
        using var t = new TestDb();
        var apunte = new Apunte { TituloNota = "Nota", EstudianteId = Guid.NewGuid() };

        await Crear(t.Context).CrearRapidoAsync(apunte);

        Assert.NotEqual(Guid.Empty, apunte.ApunteId);
        Assert.NotNull(apunte.FechaRegistro);
    }

    [Fact]
    public async Task Crear_SinTitulo_DevuelveFallo()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearAsync(new Apunte { TituloNota = "" });

        Assert.False(r.Ok);
    }

    [Fact]
    public async Task Listar_SoloDevuelveLosApuntesDelDueno()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        t.Context.Apuntes.AddRange(Datos.Apunte(yo, "Mío"), Datos.Apunte(Guid.NewGuid(), "Ajeno"));
        await t.Context.SaveChangesAsync();

        var lista = await Crear(t.Context).ListarAsync(yo);

        Assert.Single(lista);
        Assert.Equal("Mío", lista[0].TituloNota);
    }

    [Fact]
    public async Task Listar_OrdenaPorFechaDescendente()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var viejo = Datos.Apunte(yo, "Viejo");
        viejo.FechaRegistro = DateTime.UtcNow.AddDays(-2);
        var nuevo = Datos.Apunte(yo, "Nuevo");
        nuevo.FechaRegistro = DateTime.UtcNow;
        t.Context.Apuntes.AddRange(viejo, nuevo);
        await t.Context.SaveChangesAsync();

        var lista = await Crear(t.Context).ListarAsync(yo);

        Assert.Equal("Nuevo", lista[0].TituloNota);
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

        var lista = await Crear(t.Context).ListarAsync(yo);

        Assert.True(lista.Single(x => x.TituloNota == "Con").TieneResumen);
        Assert.False(lista.Single(x => x.TituloNota == "Sin").TieneResumen);
    }

    [Fact]
    public async Task AutoSave_DeOtroDueno_DevuelveFallo()
    {
        using var t = new TestDb();
        var ajeno = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(ajeno);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).AutoSaveAsync(ajeno.ApunteId, Guid.NewGuid(), "t", "c");

        Assert.False(r.Ok);
    }

    [Fact]
    public async Task AutoSave_SinTitulo_UsaSinTitulo()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = Datos.Apunte(yo);
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).AutoSaveAsync(apunte.ApunteId, yo, "   ", "<p>x</p>");

        Assert.True(r.Ok);
        Assert.Equal("Sin título", (await t.Context.Apuntes.FindAsync(apunte.ApunteId))!.TituloNota);
    }

    [Fact]
    public async Task Eliminar_DeOtroDueno_DevuelveFalloYNoBorra()
    {
        using var t = new TestDb();
        var ajeno = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(ajeno);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).EliminarAsync(ajeno.ApunteId, Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Single(t.Context.Apuntes);
    }

    [Fact]
    public async Task Eliminar_Propio_BorraElApunte()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = Datos.Apunte(yo);
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).EliminarAsync(apunte.ApunteId, yo);

        Assert.True(r.Ok);
        Assert.Empty(t.Context.Apuntes);
    }

    [Fact]
    public async Task ResolverMateria_CreaLaMateriaSiNoExiste()
    {
        using var t = new TestDb();

        var id = await Crear(t.Context).ResolverMateriaAsync(Guid.NewGuid(), null, "Matemáticas");

        Assert.NotNull(id);
        Assert.Single(t.Context.Materias);
    }

    [Fact]
    public async Task ResolverMateria_ReutilizaLaExistente()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var servicio = Crear(t.Context);

        var id1 = await servicio.ResolverMateriaAsync(yo, null, "Historia");
        var id2 = await servicio.ResolverMateriaAsync(yo, null, "Historia");

        Assert.Equal(id1, id2);
        Assert.Single(t.Context.Materias);
    }

    [Fact]
    public async Task ResolverMateria_RechazaUnaMateriaAjena()
    {
        using var t = new TestDb();
        var materia = new Materia { MateriaId = Guid.NewGuid(), NombreMateria = "X", EstudianteId = Guid.NewGuid() };
        t.Context.Materias.Add(materia);
        await t.Context.SaveChangesAsync();

        var id = await Crear(t.Context).ResolverMateriaAsync(Guid.NewGuid(), materia.MateriaId, null);

        Assert.Null(id);
    }
}
