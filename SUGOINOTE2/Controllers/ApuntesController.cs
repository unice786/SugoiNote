using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers;

[Authorize]
public class ApuntesController(IApunteService apuntes, ICurrentUser usuario, ILogger<ApuntesController> logger) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        try
        {
            var lista = await apuntes.ListarAsync(usuario.RequireId(), ct);
            var materias = await apuntes.ListarMateriasAsync(usuario.RequireId(), ct);

            ViewBag.Materias = materias.Select(m => new MateriaVM { MateriaId = m.MateriaId, NombreMateria = m.NombreMateria }).ToList();

            return View(lista.Select(Mapear).ToList());
        }
        catch (Exception ex)
        {
            // Antes devolvía una lista vacía sin avisar: el usuario veía "no tienes apuntes".
            logger.LogError(ex, "No se pudo listar los apuntes");
            TempData["Error"] = "No se pudieron cargar tus apuntes. Inténtalo de nuevo en unos segundos.";
            return View(new List<ApunteVM>());
        }
    }

    [HttpGet]
    public IActionResult Create() => View(new Apunte());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(Apunte model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View(model);

        var estudianteId = usuario.RequireId();

        model.EstudianteId = estudianteId;
        model.MateriaId = await apuntes.ResolverMateriaAsync(estudianteId, model.MateriaId, model.NuevaMateriaNombre, ct);

        var resultado = await apuntes.CrearAsync(model, ct);

        if (!resultado.Ok)
        {
            ModelState.AddModelError(string.Empty, resultado.Error ?? "No se pudo crear el apunte.");
            return View(model);
        }

        TempData["Exito"] = "Apunte creado.";
        return RedirectToAction(nameof(Editor), new { id = model.ApunteId });
    }

    /// <summary>Creación rápida desde el modal del panel. Devuelve JSON.</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CrearRapido([FromBody] CrearApunteDto dto, CancellationToken ct)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.TituloNota))
            return BadRequest(new { error = "Escribe un título para el apunte." });

        var estudianteId = usuario.RequireId();

        var apunte = new Apunte
        {
            TituloNota = dto.TituloNota.Trim(),
            MateriaId = await apuntes.ResolverMateriaAsync(estudianteId, dto.MateriaId, dto.NuevaMateriaNombre, ct),
            EstudianteId = estudianteId,
            ContenidoTexto = dto.ContenidoTexto,
        };

        var resultado = await apuntes.CrearRapidoAsync(apunte, ct);

        return resultado.Ok
            ? Ok(new { ok = true, apunteId = apunte.ApunteId })
            : BadRequest(new { error = resultado.Error });
    }

    [HttpGet]
    public async Task<IActionResult> Editor(Guid id, CancellationToken ct)
    {
        var apunte = await apuntes.ObtenerAsync(id, usuario.RequireId(), ct);

        // El filtro por propietario vive en el servicio: si no es tuyo, no existe.
        return apunte is null ? NotFound() : View(apunte);
    }

    /// <summary>
    /// Guardado automático del editor. Devuelve 404 si no se guardó nada, para que el cliente
    /// pueda avisar en lugar de mostrar "Guardado" cuando en realidad se perdió el contenido.
    /// </summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> AutoSave([FromBody] AutoSaveDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ApunteId, out var apunteId))
            return BadRequest(new { error = "El identificador del apunte no es válido." });

        var resultado = await apuntes.AutoSaveAsync(apunteId, usuario.RequireId(), dto.Titulo ?? string.Empty, dto.Contenido, ct);

        return resultado.Ok ? Ok(new { ok = true }) : BadRequest(new { error = resultado.Error });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Eliminar(string? apunteId, CancellationToken ct)
    {
        if (!Guid.TryParse(apunteId, out var id))
            return BadRequest(new { error = "El identificador del apunte no es válido." });

        var resultado = await apuntes.EliminarAsync(id, usuario.RequireId(), ct);

        return resultado.Ok ? Ok(new { ok = true }) : BadRequest(new { error = resultado.Error });
    }

    [HttpGet]
    public async Task<IActionResult> GetMaterias(CancellationToken ct)
    {
        var materias = await apuntes.ListarMateriasAsync(usuario.RequireId(), ct);
        return Ok(materias.Select(m => new { materiaId = m.MateriaId, nombreMateria = m.NombreMateria }));
    }

    internal static ApunteVM Mapear(ApunteListItem a) => new()
    {
        ApunteId = a.ApunteId,
        TituloNota = a.TituloNota,
        MateriaId = a.MateriaId,
        NombreMateria = a.NombreMateria,
        FechaRegistro = a.FechaRegistro,
        TieneResumen = a.TieneResumen,
    };
}