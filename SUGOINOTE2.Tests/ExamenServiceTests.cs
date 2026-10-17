using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Common;
using SugoiNote.Services.Examenes;
using SugoiNote.Services.Ia;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del servicio de exámenes: validaciones de generación, parseo del JSON de la IA,
/// calificación y control de propiedad. Se usa una BD SQLite porque el servicio abre
/// transacciones explícitas (el proveedor InMemory no las soporta).
/// </summary>
public class ExamenServiceTests
{
    private static ExamenService Crear(Sugoinotee2Context db, FakeIaClient ia, int maxPreguntas = 50) =>
        new(db, ia, new SugoiHtmlSanitizer(),
            Datos.Opciones(new LimitesOptions { MaxCantidadPreguntas = maxPreguntas }),
            NullLogger<ExamenService>.Instance);

    private static FakeIaClient IaConPreguntas(string json) =>
        new() { Json = (_, _) => JsonNode.Parse(json)! };

    private static async Task<Apunte> SembrarApunte(Sugoinotee2Context db, Guid estudianteId,
        string contenido = "<p>Contenido del apunte</p>")
    {
        var apunte = Datos.Apunte(estudianteId, contenido: contenido);
        db.Apuntes.Add(apunte);
        await db.SaveChangesAsync();
        return apunte;
    }

    /// <summary>Crea un examen con <paramref name="total"/> preguntas, de las que las primeras
    /// <paramref name="correctas"/> tienen una opción marcada como correcta.</summary>
    private static async Task<Examene> SembrarExamen(Sugoinotee2Context db, Guid estudianteId, int correctas, int total)
    {
        var apunte = Datos.Apunte(estudianteId, titulo: "Apunte de examen");
        var examen = new Examene
        {
            ExamenId = Guid.NewGuid(),
            ApunteId = apunte.ApunteId,
            FechaRealizacion = DateTime.UtcNow,
        };
        apunte.Examenes.Add(examen);
        db.Apuntes.Add(apunte);

        for (var i = 0; i < total; i++)
        {
            var pregunta = new Pregunta
            {
                PreguntaId = Guid.NewGuid(),
                ExamenId = examen.ExamenId,
                TextoPregunta = $"Pregunta {i + 1}",
            };
            pregunta.Opciones.Add(new OpcionRespuesta
            {
                OpcionId = Guid.NewGuid(),
                PreguntaId = pregunta.PreguntaId,
                TextoOpcion = "Correcta",
                EsLaCorrecta = i < correctas,
            });
            pregunta.Opciones.Add(new OpcionRespuesta
            {
                OpcionId = Guid.NewGuid(),
                PreguntaId = pregunta.PreguntaId,
                TextoOpcion = "Incorrecta",
                EsLaCorrecta = false,
            });
            examen.Preguntas.Add(pregunta);
        }

        await db.SaveChangesAsync();
        return examen;
    }

    private static Dictionary<Guid, Guid> RespuestasCorrectas(Sugoinotee2Context db, Guid examenId)
    {
        var ids = db.Preguntas.Where(p => p.ExamenId == examenId).Select(p => p.PreguntaId).ToList();

        return db.OpcionesRespuesta
            .Where(o => o.EsLaCorrecta && o.PreguntaId != null && ids.Contains(o.PreguntaId.Value))
            .ToList()
            .ToDictionary(o => o.PreguntaId!.Value, o => o.OpcionId);
    }

    // ── Generación ─────────────────────────────────────────────

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Generar_CantidadInvalida_DevuelveError(int cantidad)
    {
        using var t = new TestDb();

        var (ok, _, error) = await Crear(t.Context, new FakeIaClient())
            .GenerarAsync(Guid.NewGuid(), Guid.NewGuid(), "multiple", cantidad);

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Generar_ExcedeElMaximoConfigurado_DevuelveError()
    {
        using var t = new TestDb();

        var (ok, _, error) = await Crear(t.Context, new FakeIaClient(), maxPreguntas: 5)
            .GenerarAsync(Guid.NewGuid(), Guid.NewGuid(), "multiple", 6);

        Assert.False(ok);
        Assert.Contains("más de 5", error!);
    }

    [Fact]
    public async Task Generar_ApunteInexistente_DevuelveError()
    {
        using var t = new TestDb();

        var (ok, _, _) = await Crear(t.Context, new FakeIaClient())
            .GenerarAsync(Guid.NewGuid(), Guid.NewGuid(), "multiple", 5);

        Assert.False(ok);
    }

    [Fact]
    public async Task Generar_ApunteVacio_DevuelveError()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo, contenido: "   ");

        var (ok, _, error) = await Crear(t.Context, new FakeIaClient())
            .GenerarAsync(apunte.ApunteId, yo, "multiple", 5);

        Assert.False(ok);
        Assert.Contains("vacío", error!);
    }

    [Fact]
    public async Task Generar_FalloDeIa_DevuelveElMensajeDeLaIa()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = new FakeIaClient { Excepcion = new IaException("sin cuota") };

        var (ok, _, error) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo, "multiple", 5);

        Assert.False(ok);
        Assert.Equal("sin cuota", error);
    }

    [Fact]
    public async Task Generar_SinListaDePreguntas_DevuelveError()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);

        var (ok, _, error) = await Crear(t.Context, IaConPreguntas("{}"))
            .GenerarAsync(apunte.ApunteId, yo, "multiple", 5);

        Assert.False(ok);
        Assert.Contains("No se pudieron generar", error!);
    }

    [Fact]
    public async Task Generar_Ok_PersistePreguntasYOpciones()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = IaConPreguntas("""
            {"preguntas":[
              {"texto":"¿Cuánto es 2+2?","opciones":[
                 {"texto":"4","esCorrecta":true},
                 {"texto":"3","esCorrecta":false},
                 {"texto":"5","esCorrecta":false}
              ]}
            ]}
            """);

        var (ok, examenId, error) = await Crear(t.Context, ia)
            .GenerarAsync(apunte.ApunteId, yo, "multiple", 5);

        Assert.True(ok);
        Assert.Null(error);
        Assert.NotNull(examenId);

        var examen = t.Context.Examenes.Include(e => e.Preguntas).ThenInclude(p => p.Opciones).Single();
        Assert.Single(examen.Preguntas);
        Assert.Equal(3, examen.Preguntas.Single().Opciones.Count);
        Assert.Single(examen.Preguntas.Single().Opciones, o => o.EsLaCorrecta);
    }

    [Fact]
    public async Task Generar_DescartaPreguntasSinOpcionesValidas()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var apunte = await SembrarApunte(t.Context, yo);
        var ia = IaConPreguntas("""{"preguntas":[{"texto":"sin opciones","opciones":[]}]}""");

        var (ok, _, error) = await Crear(t.Context, ia).GenerarAsync(apunte.ApunteId, yo, "multiple", 5);

        Assert.False(ok);
        Assert.Contains("No se pudieron generar", error!);
    }

    // ── Consulta ───────────────────────────────────────────────

    [Fact]
    public async Task Obtener_RespetaElPropietario()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 1, total: 2);
        var servicio = Crear(t.Context, new FakeIaClient());

        Assert.NotNull(await servicio.ObtenerAsync(examen.ExamenId, yo));
        Assert.Null(await servicio.ObtenerAsync(examen.ExamenId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Obtener_CalculaCorrectasEIncorrectasTrasCalificar()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 1, total: 2);
        await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, RespuestasCorrectas(t.Context, examen.ExamenId));

        var vm = await Crear(t.Context, new FakeIaClient()).ObtenerAsync(examen.ExamenId, yo);

        Assert.Equal(2, vm!.Total);
        Assert.Equal(1, vm.Correctas);
        Assert.Equal(1, vm.Incorrectas);
    }

    // ── Calificación ───────────────────────────────────────────

    [Fact]
    public async Task Calificar_ExamenInexistente_DevuelveError()
    {
        using var t = new TestDb();

        var (ok, _, _, _, error) = await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(Guid.NewGuid(), Guid.NewGuid(), new Dictionary<Guid, Guid>());

        Assert.False(ok);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task Calificar_ExamenYaCalificado_DevuelveError()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 1, total: 2);
        examen.CalificacionFinal = 80m;
        await t.Context.SaveChangesAsync();

        var (ok, _, _, _, error) = await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, new Dictionary<Guid, Guid>());

        Assert.False(ok);
        Assert.Contains("ya fue calificado", error!);
    }

    [Fact]
    public async Task Calificar_TodasCorrectas_NotaCien()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 2, total: 2);

        var (ok, nota, total, correctas, _) = await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, RespuestasCorrectas(t.Context, examen.ExamenId));

        Assert.True(ok);
        Assert.Equal(100m, nota);
        Assert.Equal(2, total);
        Assert.Equal(2, correctas);
    }

    [Fact]
    public async Task Calificar_LaMitad_NotaCincuenta()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 1, total: 2);
        var unaSola = RespuestasCorrectas(t.Context, examen.ExamenId).Take(1)
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var (ok, nota, _, correctas, _) = await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, unaSola);

        Assert.True(ok);
        Assert.Equal(50m, nota);
        Assert.Equal(1, correctas);
    }

    [Fact]
    public async Task Calificar_OpcionQueNoPerteneceALaPregunta_NoCuenta()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 2, total: 2);
        var ids = t.Context.Preguntas.Where(p => p.ExamenId == examen.ExamenId)
            .Select(p => p.PreguntaId).ToList();

        // La opción correcta de la segunda pregunta se envía como respuesta de la primera.
        var opcionAjena = t.Context.OpcionesRespuesta
            .First(o => o.PreguntaId == ids[1] && o.EsLaCorrecta);
        var respuestas = new Dictionary<Guid, Guid> { [ids[0]] = opcionAjena.OpcionId };

        var (ok, nota, _, correctas, _) = await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, respuestas);

        Assert.True(ok);
        Assert.Equal(0, correctas);
        Assert.Equal(0m, nota);
    }

    [Fact]
    public async Task Calificar_GuardaLaCalificacionFinal()
    {
        using var t = new TestDb();
        var yo = Guid.NewGuid();
        var examen = await SembrarExamen(t.Context, yo, correctas: 2, total: 2);

        await Crear(t.Context, new FakeIaClient())
            .CalificarAsync(examen.ExamenId, yo, RespuestasCorrectas(t.Context, examen.ExamenId));

        var guardado = await t.Context.Examenes.FindAsync(examen.ExamenId);
        Assert.Equal(100m, guardado!.CalificacionFinal);
    }
}
