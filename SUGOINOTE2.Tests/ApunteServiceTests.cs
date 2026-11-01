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

    [Fact]
    public async Task ListarMaterias_SoloDevuelveLasDelEstudianteOrdenadas()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        t.Context.Materias.AddRange(
            new Materia { MateriaId = Guid.NewGuid(), NombreMateria = "Zoologia", EstudianteId = yo },
            new Materia { MateriaId = Guid.NewGuid(), NombreMateria = "Algebra", EstudianteId = yo },
            new Materia { MateriaId = Guid.NewGuid(), NombreMateria = "Ajena", EstudianteId = Guid.NewGuid() });
        await t.Context.SaveChangesAsync();

        var materias = await Crear(t.Context).ListarMateriasAsync(yo);

        Assert.Equal(["Algebra", "Zoologia"], materias.Select(m => m.NombreMateria).ToArray());
    }

    [Fact]
    public async Task ListarRecientes_DevuelveSoloLaCantidadPedida()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        for (var i = 0; i < 5; i++)
        {
            t.Context.Apuntes.Add(new Apunte
            {
                ApunteId = Guid.NewGuid(),
                TituloNota = $"Apunte {i}",
                EstudianteId = yo,
                FechaRegistro = DateTime.UtcNow.AddMinutes(-i),
            });
        }
        await t.Context.SaveChangesAsync();

        var recientes = await Crear(t.Context).ListarRecientesAsync(yo, 2);

        Assert.Equal(2, recientes.Count);
    }

    [Fact]
    public async Task Obtener_DeOtroDueno_DevuelveNull()
    {
        using var t = new TestDb();
        var apunte = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        Assert.Null(await Crear(t.Context).ObtenerAsync(apunte.ApunteId, Guid.NewGuid()));
        Assert.NotNull(await Crear(t.Context).ObtenerAsync(apunte.ApunteId, apunte.EstudianteId!.Value));
    }

    [Fact]
    public async Task Crear_DatosValidos_GuardaYRecortaElTitulo()
    {
        using var t = new TestDb();
        var apunte = new Apunte
        {
            TituloNota = "  " + new string('t', 230) + "  ",
            EstudianteId = Guid.NewGuid(),
            ContenidoTexto = "<p>ok</p>",
        };

        var r = await Crear(t.Context).CrearAsync(apunte);

        Assert.True(r.Ok);
        var guardado = t.Context.Apuntes.Single();
        Assert.Equal(200, guardado.TituloNota.Length);
        Assert.NotEqual(Guid.Empty, guardado.ApunteId);
        Assert.NotNull(guardado.FechaRegistro);
    }

    [Fact]
    public async Task AutoSave_Propio_ActualizaTituloYContenido()
    {
        using var t = new TestDb();
        var apunte = Datos.Apunte(Guid.NewGuid(), titulo: "Viejo");
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).AutoSaveAsync(
            apunte.ApunteId, apunte.EstudianteId!.Value, "  Nuevo  ", "<p>ok</p><script>alert(1)</script>");

        Assert.True(r.Ok);
        var guardado = t.Context.Apuntes.Single();
        Assert.Equal("Nuevo", guardado.TituloNota);
        Assert.DoesNotContain("<script", guardado.ContenidoTexto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AutoSave_TituloMuyLargo_SeRecortaA200()
    {
        using var t = new TestDb();
        var apunte = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        await Crear(t.Context).AutoSaveAsync(apunte.ApunteId, apunte.EstudianteId!.Value, new string('x', 260), null);

        Assert.Equal(200, t.Context.Apuntes.Single().TituloNota.Length);
    }

    [Fact]
    public async Task GuardarResumen_DeOtroDueno_Falla()
    {
        using var t = new TestDb();
        var apunte = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).GuardarResumenAsync(apunte.ApunteId, Guid.NewGuid(), "<p>resumen</p>");

        Assert.False(r.Ok);
        Assert.Null(t.Context.Apuntes.Single().ResumenGeneradoIA);
    }

    [Fact]
    public async Task GuardarResumen_Propio_GuardaElHtmlSaneado()
    {
        using var t = new TestDb();
        var apunte = Datos.Apunte(Guid.NewGuid());
        t.Context.Apuntes.Add(apunte);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).GuardarResumenAsync(
            apunte.ApunteId, apunte.EstudianteId!.Value, "<h2>Resumen</h2><script>alert(1)</script>");

        Assert.True(r.Ok);
        var guardado = t.Context.Apuntes.Single().ResumenGeneradoIA!;
        Assert.Contains("Resumen", guardado);
        Assert.DoesNotContain("<script", guardado, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Eliminar_Inexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).EliminarAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(r.Ok);
    }

    [Fact]
    public async Task ResolverMateria_SinDatos_DevuelveNull()
    {
        using var t = new TestDb();

        Assert.Null(await Crear(t.Context).ResolverMateriaAsync(Guid.NewGuid(), null, "   "));
    }

    [Fact]
    public async Task ResolverMateria_NombreMuyLargo_SeRecortaA100()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();

        var id = await Crear(t.Context).ResolverMateriaAsync(yo, null, new string('m', 130));

        Assert.NotNull(id);
        Assert.Equal(100, t.Context.Materias.Single().NombreMateria.Length);
    }
}
