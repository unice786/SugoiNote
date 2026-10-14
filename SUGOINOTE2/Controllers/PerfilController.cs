using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Common;
using SugoiNote.Services.Perfiles;

namespace SugoiNote.Controllers;

[Authorize]
public class PerfilController(IPerfilService perfil, ICurrentUser usuario) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var vm = await perfil.ObtenerAsync(usuario.RequireId(), ct);
        if (vm is null) return NotFound();

        return View(new PerfilVM
        {
            EstudianteId = vm.EstudianteId,
            NombreCompleto = vm.NombreCompleto,
            Correo = vm.CorreoElectronico,
            FotoPerfil = vm.FotoPerfil,
            FechaCreacion = vm.FechaCreacion,
            TotalApuntes = vm.TotalApuntes,
            TotalExamenes = vm.TotalExamenes,
            TotalResumenes = vm.TotalApuntes,
            TotalPublicaciones = 0,
            TotalMaterias = vm.TotalMaterias,
            ApuntesEsteMes = vm.ApuntesEsteMes,
            DiasActivos30 = vm.DiasActivo,
            TasaApuntesMes = vm.TasaApuntesMes,
            Promedio = vm.Promedio,
            ApuntesPorMes = vm.ApuntesPorMes.Select(x => new StatBarVM { Etiqueta = x.Etiqueta, Valor = x.Valor }).ToList(),
            ExamenesPorMes = [],
        });
    }

    [HttpPost]
    public async Task<IActionResult> Actualizar([FromBody] ActualizarPerfilDto dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new { error = "Datos inválidos." });

        var (ok, error) = await perfil.ActualizarAsync(usuario.RequireId(), dto.NombreCompleto ?? "", dto.Correo ?? "", ct);

        if (!ok) return BadRequest(new { error });

        // Se re-emite la cookie para que el nombre del sidebar refleje el cambio.
        TempData["Exito"] = "Perfil actualizado.";
        return Ok(new { ok = true });
    }

    [HttpPost]
    public async Task<IActionResult> ActualizarFoto([FromBody] ActualizarFotoDto dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new { error = "Datos inválidos." });

        var (ok, error) = await perfil.ActualizarFotoAsync(usuario.RequireId(), dto.FotoPerfil ?? "", ct);

        return ok ? Ok(new { ok = true }) : BadRequest(new { error });
    }
}