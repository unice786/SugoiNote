using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers.Api;

/// <summary>
/// Apuntes para la app movil. Reutiliza <see cref="IApunteService"/>, que ya
/// aplica el filtro por propietario.
/// </summary>
[ApiController]
[Route("api/apuntes")]
[Authorize]
[Produces("application/json")]
public class ApiApuntesController(IApunteService apuntes, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Lista los apuntes del estudiante autenticado.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApunteDto[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var lista = await apuntes.ListarAsync(usuario.RequireId(), ct);
        return Ok(lista.Select(ApunteDto.Desde).ToList());
    }

    /// <summary>Crea un apunte nuevo.</summary>
    [HttpPost]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Crear([FromBody] CrearApunteRequest dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.TituloNota))
            return BadRequest(new ApiError("Escribe un título para el apunte."));

        var apunte = new Apunte
        {
            ApunteId = Guid.NewGuid(),
            TituloNota = dto.TituloNota.Trim(),
            EstudianteId = usuario.RequireId(),
            MateriaId = await apuntes.ResolverMateriaAsync(usuario.RequireId(), dto.MateriaId, dto.NuevaMateriaNombre, ct),
            ContenidoTexto = dto.ContenidoTexto,
        };

        var resultado = await apuntes.CrearRapidoAsync(apunte, ct);
        return resultado.Ok
            ? Ok(new { apunteId = apunte.ApunteId })
            : BadRequest(new ApiError(resultado.Error ?? "No se pudo crear el apunte."));
    }

    /// <summary>Devuelve un apunte con su contenido, para abrirlo en el editor.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApunteDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obtener(Guid id, CancellationToken ct)
    {
        var apunte = await apuntes.ObtenerAsync(id, usuario.RequireId(), ct);

        // El servicio ya filtra por propietario: si no es tuyo, no existe.
        if (apunte is null) return NotFound();

        return Ok(new ApunteDto
        {
            ApunteId = apunte.ApunteId,
            TituloNota = apunte.TituloNota,
            ContenidoTexto = apunte.ContenidoTexto,
            FechaRegistro = apunte.FechaRegistro,
            TieneResumen = !string.IsNullOrEmpty(apunte.ResumenGeneradoIA),
            TotalExamenes = 0,
        });
    }

    /// <summary>Guardado automático del editor.</summary>
    [HttpPost("{id:guid}/autosave")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AutoSave(Guid id, [FromBody] AutoSaveRequest dto, CancellationToken ct)
    {
        if (dto is null || dto.Titulo is null)
            return BadRequest(new ApiError("Datos inválidos."));

        var resultado = await apuntes.AutoSaveAsync(id, usuario.RequireId(), dto.Titulo, dto.Contenido, ct);

        return resultado.Ok
            ? Ok(new { guardado = true })
            : BadRequest(new ApiError(resultado.Error ?? "No se pudo guardar."));
    }

    /// <summary>Elimina un apunte del estudiante.</summary>
    [HttpDelete("{id:guid}")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var resultado = await apuntes.EliminarAsync(id, usuario.RequireId(), ct);

        return resultado.Ok
            ? Ok(new { eliminado = true })
            : BadRequest(new ApiError(resultado.Error ?? "No se pudo eliminar el apunte."));
    }
}

// ── Contratos ──────────────────────────────────────────────────

public record CrearApunteRequest(string? TituloNota, string? ContenidoTexto, Guid? MateriaId, string? NuevaMateriaNombre);

public record AutoSaveRequest(string? Titulo, string? Contenido);

/// <summary>
/// Forma que consume la app movil. No se serializa la entidad <see cref="Apunte"/>
/// directamente para no arrastrar campos internos.
/// </summary>
public record ApunteDto
{
    public Guid ApunteId { get; init; }
    public string TituloNota { get; init; } = string.Empty;
    public string? ContenidoTexto { get; init; }
    public DateTime? FechaRegistro { get; init; }
    public string? MateriaNombre { get; init; }
    public bool TieneResumen { get; init; }
    public int TotalExamenes { get; init; }

    public static ApunteDto Desde(ApunteListItem a) => new()
    {
        ApunteId = a.ApunteId,
        TituloNota = a.TituloNota,
        FechaRegistro = a.FechaRegistro,
        MateriaNombre = a.NombreMateria,
        TieneResumen = a.TieneResumen,
        TotalExamenes = a.TotalExamenes,
    };
}