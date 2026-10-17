using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SugoiNote.Services.Common;
using SugoiNote.Services.Perfiles;

namespace SugoiNote.Controllers.Api;

/// <summary>Perfil del estudiante: datos y estadísticas.</summary>
[ApiController]
[Route("api/perfil")]
[Authorize]
[Produces("application/json")]
public class ApiPerfilController(IPerfilService perfil, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Datos y estadísticas del estudiante autenticado.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PerfilDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obtener(CancellationToken ct)
    {
        var vm = await perfil.ObtenerAsync(usuario.RequireId(), ct);
        if (vm is null) return NotFound();

        return Ok(new PerfilDto
        {
            EstudianteId = vm.EstudianteId,
            NombreCompleto = vm.NombreCompleto,
            CorreoElectronico = vm.CorreoElectronico,
            FotoPerfil = vm.FotoPerfil,
            FechaCreacion = vm.FechaCreacion,
            TotalApuntes = vm.TotalApuntes,
            TotalResumenes = vm.TotalResumenes,
            TotalExamenes = vm.TotalExamenes,
            TotalPublicaciones = vm.TotalPublicaciones,
            TotalMaterias = vm.TotalMaterias,
            Promedio = vm.Promedio,
        });
    }

    /// <summary>Actualiza nombre y correo.</summary>
    [HttpPut]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Actualizar([FromBody] ActualizarPerfilApiRequest dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new ApiError("Datos inválidos."));

        var (ok, error) = await perfil.ActualizarAsync(
            usuario.RequireId(), dto.NombreCompleto ?? "", dto.Correo ?? "", ct);

        return ok
            ? Ok(new { mensaje = "Perfil actualizado." })
            : BadRequest(new ApiError(error ?? "No se pudo actualizar el perfil."));
    }

    /// <summary>Actualiza la foto de perfil (data-URI).</summary>
    [HttpPut("foto")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ActualizarFoto([FromBody] ActualizarFotoApiRequest dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new ApiError("Datos inválidos."));

        var (ok, error) = await perfil.ActualizarFotoAsync(usuario.RequireId(), dto.FotoPerfil ?? "", ct);

        return ok ? Ok(new { mensaje = "Foto actualizada." }) : BadRequest(new ApiError(error ?? "No se pudo guardar."));
    }
}

public record ActualizarPerfilApiRequest(string? NombreCompleto, string? Correo);

public record ActualizarFotoApiRequest(string? FotoPerfil);

public record PerfilDto
{
    public Guid EstudianteId { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string CorreoElectronico { get; init; } = string.Empty;
    public string? FotoPerfil { get; init; }
    public DateTime? FechaCreacion { get; init; }
    public int TotalApuntes { get; init; }
    public int TotalResumenes { get; init; }
    public int TotalExamenes { get; init; }
    public int TotalPublicaciones { get; init; }
    public int TotalMaterias { get; init; }
    public double? Promedio { get; init; }
}