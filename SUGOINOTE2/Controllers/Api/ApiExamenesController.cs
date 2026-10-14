using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Services.Common;
using SugoiNote.Services.Examenes;

namespace SugoiNote.Controllers.Api;

/// <summary>Exámenes generados por IA, para resolverlos en el móvil.</summary>
[ApiController]
[Route("api/examenes")]
[Authorize]
[Produces("application/json")]
public class ApiExamenesController(IExamenService examenes, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Lista los exámenes del estudiante.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ExamenResumenDto[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var lista = await examenes.ListarAsync(usuario.RequireId(), ct);

        return Ok(lista.Select(x => new ExamenResumenDto(
            x.ExamenId, x.ApunteId, x.Titulo, x.Fecha, x.Nota, x.Total)).ToList());
    }

    /// <summary>Genera un examen a partir de un apunte.</summary>
    [HttpPost("generar")]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("IA")]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Generar([FromBody] GenerarExamenApiRequest dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ApunteId, out var apunteId))
            return BadRequest(new ApiError("El identificador del apunte no es válido."));

        var cantidad = dto.CantidadPreguntas <= 0 ? 5 : dto.CantidadPreguntas;

        var (ok, examenId, error) = await examenes.GenerarAsync(
            apunteId, usuario.RequireId(), dto.Tipo ?? "opcion_multiple", cantidad, ct);

        return ok ? Ok(new { examenId }) : BadRequest(new ApiError(error ?? "No se pudo generar el examen."));
    }

    /// <summary>
    /// Examen completo con sus preguntas.
    /// </summary>
    /// <remarks>
    /// <c>esLaCorrecta</c> SOLO se devuelve si el examen ya fue calificado. Enviarlo
    /// antes dejaría que el cliente se auto-aprobara: bastaría leer el JSON y marcar
    /// siempre la opción correcta.
    /// </remarks>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ExamenDetalleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obtener(Guid id, CancellationToken ct)
    {
        var vm = await examenes.ObtenerAsync(id, usuario.RequireId(), ct);

        // El servicio filtra por propietario: si no es tuyo, no existe.
        if (vm is null) return NotFound();

        var calificado = vm.CalificacionFinal is not null;

        return Ok(new ExamenDetalleDto
        {
            ExamenId = vm.ExamenId,
            TituloApunte = vm.TituloApunte,
            Calificado = calificado,
            Nota = vm.CalificacionFinal,
            Preguntas = vm.Preguntas.Select(p => new ExamenPreguntaDto
            {
                PreguntaId = p.PreguntaId,
                Texto = p.TextoPregunta,
                RespuestaSeleccionadaId = p.RespuestaSeleccionadaId,
                Opciones = p.Opciones.Select(o => new ExamenOpcionDto
                {
                    OpcionId = o.OpcionId,
                    Texto = o.TextoOpcion,
                    EsLaCorrecta = calificado && o.EsLaCorrecta,
                }).ToList(),
            }).ToList(),
        });
    }

    /// <summary>Califica el examen. Las respuestas van como mapa pregunta -> opción.</summary>
    [HttpPost("{id:guid}/calificar")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Calificar(
        Guid id, [FromBody] CalificarApiRequest dto, CancellationToken ct)
    {
        if (dto?.Respuestas is null)
            return BadRequest(new ApiError("No se recibieron respuestas."));

        // El móvil manda las claves como string; se convierten a Guid.
        var respuestas = new Dictionary<Guid, Guid>();
        foreach (var (preguntaId, opcionId) in dto.Respuestas)
        {
            if (Guid.TryParse(preguntaId, out var p) && Guid.TryParse(opcionId, out var o))
                respuestas[p] = o;
        }

        var (ok, nota, total, correctas, error) = await examenes.CalificarAsync(
            id, usuario.RequireId(), respuestas, ct);

        return ok
            ? Ok(new { nota, total, correctas })
            : BadRequest(new ApiError(error ?? "No se pudo calificar el examen."));
    }
}

public record GenerarExamenApiRequest(string? ApunteId, string? Tipo, int CantidadPreguntas);

public record CalificarApiRequest(Dictionary<string, string>? Respuestas);

public record ExamenResumenDto(
    Guid ExamenId, Guid ApunteId, string TituloApunte, DateTime? Fecha, decimal? Nota, int Total);

public record ExamenDetalleDto
{
    public Guid ExamenId { get; init; }
    public string TituloApunte { get; init; } = string.Empty;
    public bool Calificado { get; init; }
    public decimal? Nota { get; init; }
    public List<ExamenPreguntaDto> Preguntas { get; init; } = [];
}

public record ExamenPreguntaDto
{
    public Guid PreguntaId { get; init; }
    public string Texto { get; init; } = string.Empty;
    public Guid? RespuestaSeleccionadaId { get; init; }
    public List<ExamenOpcionDto> Opciones { get; init; } = [];
}

public record ExamenOpcionDto
{
    public Guid OpcionId { get; init; }
    public string Texto { get; init; } = string.Empty;
    public bool EsLaCorrecta { get; init; }
}