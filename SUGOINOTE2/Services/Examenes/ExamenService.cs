using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SugoiNote.Models;
using SugoiNote.Services.Ia;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Examenes;

public class OpcionExamen
{
    public Guid OpcionId { get; set; }
    public string TextoOpcion { get; set; } = string.Empty;
    public bool EsLaCorrecta { get; set; }
    public string? ExplicacionIA { get; set; }
}

public class PreguntaExamen
{
    public Guid PreguntaId { get; set; }
    public string TextoPregunta { get; set; } = string.Empty;
    public Guid? RespuestaSeleccionadaId { get; set; }
    public List<OpcionExamen> Opciones { get; set; } = [];
}

public class ExamenConPreguntas
{
    public Guid ExamenId { get; set; }
    public Guid ApunteId { get; set; }
    public string TituloApunte { get; set; } = string.Empty;
    public DateTime? FechaRealizacion { get; set; }
    public decimal? CalificacionFinal { get; set; }
    public bool Calificado { get; set; }

    public int Total { get; set; }
    public int Correctas { get; set; }
    public int Incorrectas { get; set; }
    public List<PreguntaExamen> Preguntas { get; set; } = [];
}

public interface IExamenService
{
    Task<IReadOnlyList<(Guid ExamenId, Guid ApunteId, string Titulo, DateTime? Fecha, decimal? Nota, int Total)>> ListarAsync(Guid estudianteId, CancellationToken ct = default);
    Task<IReadOnlyList<MateriaListItem>> ListarApuntesAsync(Guid estudianteId, CancellationToken ct = default);

    Task<(bool Ok, Guid? ExamenId, string? Error)> GenerarAsync(Guid apunteId, Guid estudianteId, string tipo, int cantidad, CancellationToken ct = default);
    Task<ExamenConPreguntas?> ObtenerAsync(Guid examenId, Guid estudianteId, CancellationToken ct = default);
    Task<(bool Ok, decimal? Calificacion, int Total, int Correctas, string? Error)> CalificarAsync(Guid examenId, Guid estudianteId, IReadOnlyDictionary<Guid, Guid> respuestas, CancellationToken ct = default);
}

public class ExamenService(
    Sugoinotee2Context db,
    IIaClient ia,
    IHtmlSanitizer sanitizer,
    IOptions<LimitesOptions> limites,
    ILogger<ExamenService> logger) : IExamenService
{
    private readonly LimitesOptions _limites = limites.Value;

    public async Task<IReadOnlyList<(Guid ExamenId, Guid ApunteId, string Titulo, DateTime? Fecha, decimal? Nota, int Total)>> ListarAsync(Guid estudianteId, CancellationToken ct = default)
    {
        var filas = await db.Examenes.AsNoTracking()
            .Where(e => e.Apunte != null && e.Apunte.EstudianteId == estudianteId)
            .OrderByDescending(e => e.FechaRealizacion)
            .Select(e => new
            {
                e.ExamenId,
                ApunteId = e.ApunteId!.Value,
                Titulo = e.Apunte!.TituloNota,
                e.FechaRealizacion,
                e.CalificacionFinal,
                Total = e.Preguntas.Count,
            })
            .ToListAsync(ct);

        return filas.Select(x => (x.ExamenId, x.ApunteId, x.Titulo, x.FechaRealizacion, x.CalificacionFinal, x.Total)).ToList();
    }

    public async Task<IReadOnlyList<MateriaListItem>> ListarApuntesAsync(Guid estudianteId, CancellationToken ct = default) =>
        await db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId)
            .OrderByDescending(a => a.FechaRegistro)
            .Select(a => new MateriaListItem { MateriaId = a.ApunteId, NombreMateria = a.TituloNota })
            .ToListAsync(ct);

    public async Task<(bool Ok, Guid? ExamenId, string? Error)> GenerarAsync(Guid apunteId, Guid estudianteId, string tipo, int cantidad, CancellationToken ct = default)
    {
        if (cantidad <= 0) return (false, null, "Indica cuántas preguntas quieres generar.");
        if (cantidad > _limites.MaxCantidadPreguntas)
            return (false, null, $"No se pueden generar más de {_limites.MaxCantidadPreguntas} preguntas de una vez.");

        var apunte = await db.Apuntes.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId, ct);

        if (apunte is null) return (false, null, "El apunte no existe o no te pertenece.");

        var contenido = (apunte.ContenidoTexto ?? string.Empty);
        if (string.IsNullOrWhiteSpace(contenido))
            return (false, null, "El apunte está vacío. Escribe algo antes de generar el examen.");

        List<PreguntaGenerada> generadas;
        try
        {
            generadas = await GenerarPreguntasIAAsync(contenido, tipo, cantidad, ct);
        }
        catch (IaException ex)
        {
            logger.LogWarning(ex, "IA no pudo generar preguntas para el apunte {ApunteId}", apunteId);
            return (false, null, ex.Message);
        }

        if (generadas.Count == 0)
            return (false, null, "No se pudieron generar preguntas a partir de este apunte.");

        var examen = new Examene
        {
            ExamenId = Guid.NewGuid(),
            ApunteId = apunteId,
            FechaRealizacion = DateTime.UtcNow,
            CalificacionFinal = null,
        };

        foreach (var p in generadas)
        {
            var pregunta = new Pregunta
            {
                PreguntaId = Guid.NewGuid(),
                TextoPregunta = sanitizer.Sanitize(p.Texto),
                Opciones = p.Opciones.Select(o => new OpcionRespuesta
                {
                    OpcionId = Guid.NewGuid(),
                    TextoOpcion = sanitizer.Sanitize(o.Texto),
                    EsLaCorrecta = o.EsCorrecta,
                }).ToList(),
            };
            examen.Preguntas.Add(pregunta);
        }

        // Una sola transaccion: antes el INSERT de cada pregunta y cada opcion iba suelto
        // y un fallo a mitad dejaba un examen incompleto en la base de datos.
        // Con EnableRetryOnFailure la transacción va dentro de la estrategia de ejecución.
        var estrategia = db.Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            db.Examenes.Add(examen);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return (true, (Guid?)examen.ExamenId, (string?)null);
        });
    }

    public async Task<ExamenConPreguntas?> ObtenerAsync(Guid examenId, Guid estudianteId, CancellationToken ct = default)
    {
        // FIX C5: antes se consultaba con JOIN pero NO se exigia el resultado; si no traia filas,
        // el codigo seguia cargando las Preguntas por el id recibido y las renderizaba.
        // Ahora: una sola consulta con TODAS las relaciones y filtro de propietario.
        var datos = await db.Examenes.AsNoTracking()
            .Where(e => e.ExamenId == examenId && e.Apunte != null && e.Apunte.EstudianteId == estudianteId)
            .Select(e => new
            {
                e.ExamenId,
                ApunteId = e.ApunteId!.Value,
                TituloApunte = e.Apunte!.TituloNota,
                e.FechaRealizacion,
                e.CalificacionFinal,
                Preguntas = e.Preguntas.Select(p => new
                {
                    p.PreguntaId,
                    p.TextoPregunta,
                    p.RespuestaSeleccionadaId,
                    Opciones = p.Opciones.Select(o => new
                    {
                        o.OpcionId,
                        o.TextoOpcion,
                        o.EsLaCorrecta,
                        o.ExplicacionIA,
                    }).ToList(),
                }).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (datos is null) return null;

        var vm = new ExamenConPreguntas
        {
            ExamenId = datos.ExamenId,
            ApunteId = datos.ApunteId,
            TituloApunte = datos.TituloApunte,
            FechaRealizacion = datos.FechaRealizacion,
            CalificacionFinal = datos.CalificacionFinal,
            Calificado = datos.CalificacionFinal is not null,
            Total = datos.Preguntas.Count,
            Preguntas = datos.Preguntas.Select(p => new PreguntaExamen
            {
                PreguntaId = p.PreguntaId,
                TextoPregunta = p.TextoPregunta,
                RespuestaSeleccionadaId = p.RespuestaSeleccionadaId,
                Opciones = p.Opciones.Select(o => new OpcionExamen
                {
                    OpcionId = o.OpcionId,
                    TextoOpcion = o.TextoOpcion,
                    EsLaCorrecta = o.EsLaCorrecta,
                    ExplicacionIA = o.ExplicacionIA,
                }).ToList(),
            }).ToList(),
        };

        vm.Correctas = vm.Preguntas.Count(p =>
            p.RespuestaSeleccionadaId is not null &&
            p.Opciones.Any(o => o.OpcionId == p.RespuestaSeleccionadaId && o.EsLaCorrecta));

        vm.Incorrectas = vm.Total - vm.Correctas;
        return vm;
    }

    public async Task<(bool, decimal?, int, int, string?)> CalificarAsync(
        Guid examenId, Guid estudianteId, IReadOnlyDictionary<Guid, Guid> respuestas, CancellationToken ct = default)
    {
        var examen = await db.Examenes
            .Include(e => e.Preguntas).ThenInclude(p => p.Opciones)
            .FirstOrDefaultAsync(e => e.ExamenId == examenId && e.Apunte != null && e.Apunte.EstudianteId == estudianteId, ct);

        if (examen is null)
            return (false, null, 0, 0, "El examen no existe o no te pertenece.");

        if (examen.CalificacionFinal is not null)
            return (false, null, 0, 0, "Este examen ya fue calificado.");

        var preguntas = examen.Preguntas.ToList();
        if (preguntas.Count == 0)
            return (false, null, 0, 0, "Este examen no tiene preguntas.");

        // Con EnableRetryOnFailure la transacción no puede abrirse a mano: va dentro de
        // la estrategia de ejecución. Los contadores se reinician dentro del bloque para
        // que un reintento no los duplique.
        var estrategia = db.Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync(async () =>
        {
            var correctas = 0;

            await using var tx = await db.Database.BeginTransactionAsync(ct);

            foreach (var pregunta in preguntas)
            {
                Guid? elegida = null;

                // FIX C4: se valida que la opcion elegida pertenezca REALMENTE a esta pregunta.
                // Antes solo se comprobaba que la opcion fuese correcta en cualquier sitio.
                if (respuestas.TryGetValue(pregunta.PreguntaId, out var opcionId) &&
                    pregunta.Opciones.Any(o => o.OpcionId == opcionId))
                {
                    elegida = opcionId;
                    if (pregunta.Opciones.Any(o => o.OpcionId == opcionId && o.EsLaCorrecta)) correctas++;
                }

                pregunta.RespuestaSeleccionadaId = elegida;
            }

            // FIX C4: el divisor es el numero de preguntas REALES del examen, no lo que envie el cliente.
            var nota = Math.Round(correctas * 100m / preguntas.Count, 2);

            examen.CalificacionFinal = nota;
            examen.FechaRealizacion = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return (true, (decimal?)nota, preguntas.Count, correctas, (string?)null);
        });
    }

    // ── Generación con IA ──────────────────────────────────────

    private sealed record PreguntaGenerada(string Texto, List<OpcionGenerada> Opciones);
    private sealed record OpcionGenerada(string Texto, bool EsCorrecta);

    private async Task<List<PreguntaGenerada>> GenerarPreguntasIAAsync(string contenido, string tipo, int cantidad, CancellationToken ct)
    {
        var texto = ExtraerTexto(contenido);
        if (texto.Length == 0) return [];

        var soloUna = !tipo.Equals("abierta", StringComparison.OrdinalIgnoreCase);
        var abierta = tipo.Equals("abierta", StringComparison.OrdinalIgnoreCase);

        var formato = abierta
            ? """
              {
                "preguntas": [
                  { "texto": "...", "opciones": [] }
                ]
              }
              """
            : """
              {
                "preguntas": [
                  {
                    "texto": "...",
                    "opciones": [
                      { "texto": "...", "esCorrecta": true },
                      { "texto": "...", "esCorrecta": false },
                      { "texto": "...", "esCorrecta": false },
                      { "texto": "...", "esCorrecta": false }
                    ]
                  }
                ]
              }
              """;

        var consignaOpciones = abierta
            ? "Genera preguntas de respuesta abierta (sin opciones)."
            : soloUna
                ? "Genera preguntas de opcion multiple con EXACTAMENTE 4 opciones y una sola respuesta correcta."
                : "Genera preguntas donde pueden existir varias respuestas correctas (marca todas las que lo sean).";

        var system = """
            Eres un profesor experto en diseño de evaluaciones educativas.
            Reglas obligatorias:
            - Responde SOLO con JSON valido, sin markdown ni comentarios.
            - Las preguntas deben basarse exclusivamente en el contenido proporcionado.
            - No inventes informacion que no este en el texto.
            - Cada pregunta debe ser clara, ambigua y autosuficiente.
            - En espanol.
            """;

        var prompt = $"""
            Basate en este apunte:

            ---
            {texto}
            ---

            {consignaOpciones}
            Genera exactamente {cantidad} preguntas.
            Estructura de respuesta:
            {formato}
            """;

        var nodo = await ia.JsonAsync(system, prompt, ct);
        var lista = nodo["preguntas"]?.AsArray();
        if (lista is null) return [];

        var resultado = new List<PreguntaGenerada>();

        foreach (var item in lista.Take(cantidad))
        {
            var textoPregunta = item?["texto"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(textoPregunta)) continue;

            var opciones = new List<OpcionGenerada>();

            if (!abierta && item?["opciones"] is System.Text.Json.Nodes.JsonArray arr)
            {
                foreach (var o in arr)
                {
                    var t = o?["texto"]?.GetValue<string>();
                    if (string.IsNullOrWhiteSpace(t)) continue;
                    opciones.Add(new OpcionGenerada(t, o?["esCorrecta"]?.GetValue<bool>() ?? false));
                }
            }

            // Descartar preguntas degenerate (sin opciones cuando se esperaban, o sin correcta).
            if (!abierta)
            {
                if (opciones.Count < 2) continue;
                if (!opciones.Any(o => o.EsCorrecta)) continue;
            }

            resultado.Add(new PreguntaGenerada(textoPregunta, opciones));
        }

        return resultado;
    }

    /// <summary>
    /// Quita el HTML del apunte y recorta. Antes se usaba <c>Regex.Replace("&lt;.*?&gt;")</c>,
    /// que deja vivo el contenido de &lt;script&gt; y los atributos onerror=.
    /// </summary>
    private static string ExtraerTexto(string html, int max = 12000)
    {
        var sinEtiquetas = System.Text.RegularExpressions.Regex.Replace(html, @"<(script|style)[^>]*>.*?</\1>", " ",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline,
            TimeSpan.FromSeconds(2));

        sinEtiquetas = System.Text.RegularExpressions.Regex.Replace(sinEtiquetas, "<[^>]+>", " ");
        sinEtiquetas = System.Net.WebUtility.HtmlDecode(sinEtiquetas);
        sinEtiquetas = System.Text.RegularExpressions.Regex.Replace(sinEtiquetas, @"\s+", " ").Trim();

        return sinEtiquetas.Length > max ? sinEtiquetas[..max] : sinEtiquetas;
    }
}