using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Services.Common;
using SugoiNote.Services.Resumenes;

namespace SugoiNote.Controllers.Api;

/// <summary>Resúmenes generados por la IA. La web y el móvil comparten servicio.</summary>
[ApiController]
[Route("api/resumenes")]
[Authorize]
[Produces("application/json")]
public class ApiResumenesController(IResumenService resumenes, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Todos los apuntes del estudiante con su resumen (vacío si no lo tiene).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ResumenDto[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(CancellationToken ct)
    {
        var lista = await resumenes.ListarAsync(usuario.RequireId(), ct);

        // ListarAsync solo trae si tiene resumen; para el detalle se pide uno a uno.
        var dtos = new List<ResumenDto>();
        foreach (var x in lista.Where(tiene => tiene.TieneResumen))
        {
            var html = await resumenes.ObtenerAsync(x.ApunteId, usuario.RequireId(), ct);
            dtos.Add(new ResumenDto(x.ApunteId, x.Titulo, html, x.Fecha));
        }

        return Ok(dtos);
    }

    /// <summary>Detalle del resumen de un apunte.</summary>
    [HttpGet("{apunteId:guid}")]
    [ProducesResponseType(typeof(ResumenDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obtener(Guid apunteId, CancellationToken ct)
    {
        var lista = await resumenes.ListarAsync(usuario.RequireId(), ct);
        var item = lista.FirstOrDefault(x => x.ApunteId == apunteId);

        // ObtenerAsync filtra por propietario, pero primero debe existir en su lista.
        if (item.Titulo is null) return NotFound();

        var html = await resumenes.ObtenerAsync(apunteId, usuario.RequireId(), ct);

        return Ok(new ResumenDto(item.ApunteId, item.Titulo, html, item.Fecha));
    }

    /// <summary>Apuntes que se pueden resumir, para el selector del movil.</summary>
    [HttpGet("apuntes")]
    [ProducesResponseType(typeof(ApunteResumenRef[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApuntes(CancellationToken ct)
    {
        var lista = await resumenes.ListarApuntesAsync(usuario.RequireId(), ct);

        // Ojo: ListarApuntesAsync usa MateriaListItem, pero guarda el id y el título
        // del APUNTE en esos campos (ver ResumenService). Aquí se renombra para que
        // el cliente no tenga que adivinarlo.
        return Ok(lista.Select(a => new ApunteResumenRef(a.MateriaId, a.NombreMateria)).ToList());
    }

    /// <summary>Genera el resumen con IA. Si la IA falla no se guarda nada.</summary>
    [HttpPost("generar")]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("IA")]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Generar([FromBody] GuardarResumenApiRequest dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ApunteId, out var apunteId))
            return BadRequest(new ApiError("El identificador del apunte no es válido."));

        var (ok, html, error) = await resumenes.GenerarAsync(apunteId, usuario.RequireId(), ct);

        return ok ? Ok(new { resumen = html }) : BadRequest(new ApiError(error ?? "No se pudo generar el resumen."));
    }
}

public record GuardarResumenApiRequest(string? ApunteId);

public record ApunteResumenRef(Guid ApunteId, string TituloNota);

public record ResumenDto(Guid ApunteId, string TituloNota, string? Resumen, DateTime? FechaRegistro);