using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Common;
using SugoiNote.Services.Comunidad;

namespace SugoiNote.Controllers;

[Authorize]
public class ComunidadController(IComunidadService comunidad, ICurrentUser usuario) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index(int pagina = 0, CancellationToken ct = default)
    {
        var (posts, hayMas) = await comunidad.ListarAsync(usuario.RequireId(), pagina, 20, ct);

        ViewBag.Pagina = pagina;
        ViewBag.HayMas = hayMas;

        return View(posts.Select(Mapear).ToList());
    }

    [HttpGet]
    public async Task<IActionResult> Ver(Guid id, CancellationToken ct)
    {
        var post = await comunidad.ObtenerAsync(id, usuario.RequireId(), ct);

        if (post is null) return NotFound();

        ViewBag.UserId = usuario.RequireId();

        var vm = Mapear(post);
        return View(new SugoiNote.Models.ViewModels.PostDetalleVM
        {
            PostId = vm.PostId,
            Titulo = vm.Titulo,
            Detalle = vm.Detalle,
            Fecha = vm.Fecha,
            TipoPost = vm.TipoPost,
            ImagenUrl = vm.ImagenUrl,
            EstudianteId = vm.EstudianteId,
            NombreEstudiante = vm.NombreEstudiante,
            FotoEstudiante = vm.FotoEstudiante,
            TotalRespuestas = vm.TotalRespuestas,
            TotalVotos = vm.TotalVotos,
            SoloUnaOpcion = vm.SoloUnaOpcion,
            YaVoto = vm.YaVoto,
            VotosUsuario = vm.VotosUsuario,
            Opciones = vm.Opciones,
            Respuestas = post.Respuestas.Select(r => new RespuestaVM
            {
                RespuestaId = r.RespuestaId,
                Texto = r.TextoRespuesta,
                Fecha = r.FechaRespuesta,
                NombreEstudiante = r.Autor.Nombre,
                FotoEstudiante = r.Autor.FotoUrl,
            }).ToList(),
        });
    }

    [HttpPost]
    public async Task<IActionResult> CrearPost([FromBody] CrearPostDto dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new { error = "Datos inválidos." });

        var (ok, error, postId) = await comunidad.CrearPostAsync(
            usuario.RequireId(), dto.Titulo ?? "", dto.Detalle ?? "", dto.ImagenUrl, ct);

        return ok ? Ok(new { ok = true, postId }) : BadRequest(new { error });
    }

    [HttpPost]
    public async Task<IActionResult> CrearEncuesta([FromBody] CrearEncuestaDto dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new { error = "Datos inválidos." });

        var (ok, error, postId) = await comunidad.CrearEncuestaAsync(
            usuario.RequireId(), dto.Titulo ?? "", dto.Detalle ?? "", dto.Opciones ?? [], dto.ImagenUrl, dto.SoloUnaOpcion, ct);

        return ok ? Ok(new { ok = true, postId }) : BadRequest(new { error });
    }

    [HttpPost]
    public async Task<IActionResult> Votar([FromBody] VotarDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.PostId, out var postId))
            return BadRequest(new { error = "Publicación no válida." });

        if (dto.OpcionIds is null || dto.OpcionIds.Count == 0)
            return BadRequest(new { error = "Selecciona al menos una opción." });

        foreach (var opcionId in dto.OpcionIds)
        {
            var (ok, error) = await comunidad.VotarAsync(usuario.RequireId(), postId, opcionId, ct);
            if (!ok) return BadRequest(new { error });
        }

        return Ok(new { ok = true });
    }

    [HttpPost]
    public async Task<IActionResult> Responder([FromBody] ResponderDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.PostId, out var postId))
            return BadRequest(new { error = "Publicación no válida." });

        var (ok, error) = await comunidad.ResponderAsync(usuario.RequireId(), postId, dto.Texto ?? "", ct);

        return ok ? Ok(new { ok = true }) : BadRequest(new { error });
    }

    [HttpPost]
    public async Task<IActionResult> EliminarPost([FromBody] EliminarPostDto dto, CancellationToken ct)
    {
        if (dto is null || !Guid.TryParse(dto.PostId, out var postId))
            return BadRequest(new { error = "Publicación no válida." });

        var (ok, error) = await comunidad.EliminarPostAsync(postId, usuario.RequireId(), ct);

        return ok ? Ok(new { ok = true }) : BadRequest(new { error });
    }

    internal static PostVM Mapear(PostListItem p) => new()
    {
        PostId = p.PostId,
        Titulo = p.Titulo,
        Detalle = p.Detalle,
        Fecha = p.FechaPublicacion,
        TipoPost = p.TipoPost,
        ImagenUrl = p.ImagenUrl,
        EstudianteId = p.AutorId,
        NombreEstudiante = p.Autor.Nombre,
        FotoEstudiante = p.Autor.FotoUrl,
        TotalRespuestas = p.TotalRespuestas,
        TotalVotos = p.TotalVotos,
        SoloUnaOpcion = p.SoloUna,
        YaVoto = p.YaVoto,
        VotosUsuario = p.OpcionesVotadas.ToList(),
        Opciones = p.Opciones.Select(o => new PostOpcionVM
        {
            OpcionId = o.OpcionId,
            Texto = o.TextoOpcion,
            TotalVotos = o.TotalVotos,
        }).ToList(),
    };
}