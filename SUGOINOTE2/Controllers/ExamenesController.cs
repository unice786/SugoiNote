using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Common;
using SugoiNote.Services.Examenes;
using SugoiNote.Services.Resumenes;

namespace SugoiNote.Controllers;

[Authorize]
public class ExamenesController(IExamenService examenes, ICurrentUser usuario) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var lista = await examenes.ListarAsync(usuario.RequireId(), ct);

        return View(lista.Select(x => new ExamenVM
        {
            ExamenId = x.ExamenId,
            ApunteId = x.ApunteId,
            Titulo = x.Titulo,
            Fecha = x.Fecha,
            Calificacion = x.Nota,
            Total = x.Total,
        }).ToList());
    }

    [HttpGet]
    public async Task<IActionResult> GetApuntes(CancellationToken ct)
    {
        var apuntes = await examenes.ListarApuntesAsync(usuario.RequireId(), ct);
        return Ok(apuntes.Select(a => new { apunteId = a.MateriaId, tituloNota = a.NombreMateria }));
    }

    [HttpPost]
    [EnableRateLimiting("IA")]
    public async Task<IActionResult> Generar([FromBody] GenerarExamenDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ApunteId, out var apunteId))
            return BadRequest(new { error = "El identificador del apunte no es válido." });

        var (ok, examenId, error) = await examenes.GenerarAsync(apunteId, usuario.RequireId(), dto.Tipo, dto.CantidadPreguntas, ct);
        if (!ok) return BadRequest(new { error });
        // Se devuelve el Id para que la vista pueda llevar directamente al examen generado.
        return Ok(new { ok = true, examenId });
    }

    [HttpGet]
    public async Task<IActionResult> Ver(Guid id, CancellationToken ct)
    {
        var vm = await examenes.ObtenerAsync(id, usuario.RequireId(), ct);

        // Si el examen no es del usuario, el servicio devuelve null: no se filtran preguntas ajenas.
        if (vm is null) return NotFound();

        return View(new SugoiNote.Models.ViewModels.ExamenDetalleVM
        {
            ExamenId = vm.ExamenId,
            TituloApunte = vm.TituloApunte,
            Fecha = vm.FechaRealizacion,
            Calificacion = vm.CalificacionFinal,
            Total = vm.Total,
            Correctas = vm.Correctas,
            Incorrectas = vm.Incorrectas,
            Preguntas = vm.Preguntas.Select(p => new SugoiNote.Models.ViewModels.ExamenPreguntaVM
            {
                PreguntaId = p.PreguntaId,
                Texto = p.TextoPregunta,
                RespuestaSeleccionadaId = p.RespuestaSeleccionadaId,
                Opciones = p.Opciones.Select(o => new SugoiNote.Models.ViewModels.ExamenOpcionVM
                {
                    OpcionId = o.OpcionId,
                    Texto = o.TextoOpcion,
                    EsCorrecta = o.EsLaCorrecta,
                    Explicacion = o.ExplicacionIA,
                }).ToList(),
            }).ToList(),
        });
    }

    [HttpPost]
    public async Task<IActionResult> Calificar([FromBody] CalificarDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ExamenId, out var examenId))
            return BadRequest(new { error = "El identificador del examen no es válido." });

        var (ok, nota, total, correctas, error) = await examenes.CalificarAsync(
            examenId, usuario.RequireId(), dto.Respuestas ?? [], ct);

        if (!ok) return BadRequest(new { error });

        return Ok(new { ok = true, nota, total, correctas });
    }
}

[Authorize]
public class ResumenesController(IResumenService resumenes, ICurrentUser usuario) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var lista = await resumenes.ListarAsync(usuario.RequireId(), ct);

        return View(lista.Select(x => new ApunteVM
        {
            ApunteId = x.ApunteId,
            TituloNota = x.Titulo,
            FechaRegistro = x.Fecha,
            TieneResumen = x.TieneResumen,
        }).ToList());
    }

    [HttpGet]
    public async Task<IActionResult> GetApuntes(CancellationToken ct)
    {
        var apuntes = await resumenes.ListarApuntesAsync(usuario.RequireId(), ct);
        return Ok(apuntes.Select(a => new { apunteId = a.MateriaId, tituloNota = a.NombreMateria }));
    }

    [HttpPost]
    [EnableRateLimiting("IA")]
    public async Task<IActionResult> Generar([FromBody] GuardarResumenDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.ApunteId, out var apunteId))
            return BadRequest(new { error = "El identificador del apunte no es válido." });

        // FIX C10: si la IA falla se devuelve el error y NO se escribe nada en la base de datos.
        var (ok, html, error) = await resumenes.GenerarAsync(apunteId, usuario.RequireId(), ct);

        if (!ok) return BadRequest(new { error });

        return Ok(new { ok = true, resumen = html });
    }

    [HttpGet]
    public async Task<IActionResult> ObtenerResumen(Guid apunteId, CancellationToken ct)
    {
        var resumen = await resumenes.ObtenerAsync(apunteId, usuario.RequireId(), ct);
        return Ok(new { resumen });
    }
}
