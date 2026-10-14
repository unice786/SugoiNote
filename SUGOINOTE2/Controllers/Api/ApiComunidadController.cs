using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SugoiNote.Services.Common;
using SugoiNote.Services.Comunidad;

namespace SugoiNote.Controllers.Api;

/// <summary>Comunidad: preguntas, encuestas, respuestas y votos.</summary>
[ApiController]
[Route("api/comunidad")]
[Authorize]
[Produces("application/json")]
public class ApiComunidadController(IComunidadService comunidad, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Listado paginado de publicaciones.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PostDto[]), StatusCodes.Status200OK)]
    public async Task<IActionResult> Listar(int pagina = 0, CancellationToken ct = default)
    {
        var (posts, _) = await comunidad.ListarAsync(usuario.RequireId(), pagina, 20, ct);

        return Ok(posts.Select(p => new PostDto
        {
            PostId = p.PostId,
            Titulo = p.Titulo,
            Detalle = p.Detalle,
            Autor = p.Autor.Nombre,
            FotoUrl = p.Autor.FotoUrl,
            EsEncuesta = p.TipoPost == "Encuesta",
            Fecha = p.FechaPublicacion,
            TotalRespuestas = p.TotalRespuestas,
            TotalVotos = p.TotalVotos,
        }).ToList());
    }

    /// <summary>Detalle de una publicación con sus respuestas u opciones.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PostDetalleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Obtener(Guid id, CancellationToken ct)
    {
        var post = await comunidad.ObtenerAsync(id, usuario.RequireId(), ct);
        if (post is null) return NotFound();

        return Ok(new PostDetalleDto
        {
            PostId = post.PostId,
            Titulo = post.Titulo,
            Detalle = post.Detalle,
            Autor = post.Autor.Nombre,
            Fecha = post.FechaPublicacion,
            EsEncuesta = post.TipoPost == "Encuesta",
            SoloUnaOpcion = post.SoloUna,
            TotalVotos = post.TotalVotos,
            Opciones = post.Opciones.Select(o => new PostOpcionDto
            {
                OpcionId = o.OpcionId,
                Texto = o.TextoOpcion,
                TotalVotos = o.TotalVotos,
                Seleccionada = post.OpcionesVotadas.Contains(o.OpcionId),
            }).ToList(),
            Respuestas = post.Respuestas.Select(r => new PostRespuestaDto
            {
                RespuestaId = r.RespuestaId,
                Autor = r.Autor.Nombre,
                Texto = r.TextoRespuesta,
                Fecha = r.FechaRespuesta,
            }).ToList(),
        });
    }

    /// <summary>Publica una pregunta.</summary>
    [HttpPost("posts")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CrearPost([FromBody] CrearPostApiRequest dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new ApiError("Datos inválidos."));

        var (ok, error, postId) = await comunidad.CrearPostAsync(
            usuario.RequireId(), dto.Titulo ?? "", dto.Detalle ?? "", dto.ImagenUrl, ct);

        return ok ? Ok(new { postId }) : BadRequest(new ApiError(error ?? "No se pudo publicar."));
    }

    /// <summary>Publica una encuesta.</summary>
    [HttpPost("encuestas")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CrearEncuesta([FromBody] CrearEncuestaApiRequest dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new ApiError("Datos inválidos."));

        var (ok, error, postId) = await comunidad.CrearEncuestaAsync(
            usuario.RequireId(), dto.Titulo ?? "", dto.Detalle ?? "", dto.Opciones ?? [], dto.ImagenUrl, dto.SoloUnaOpcion, ct);

        return ok ? Ok(new { postId }) : BadRequest(new ApiError(error ?? "No se pudo publicar."));
    }

    /// <summary>Responde a una publicación.</summary>
    [HttpPost("{id:guid}/responder")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Responder(Guid id, [FromBody] ResponderApiRequest dto, CancellationToken ct)
    {
        if (dto is null) return BadRequest(new ApiError("Datos inválidos."));

        var (ok, error) = await comunidad.ResponderAsync(usuario.RequireId(), id, dto.Texto ?? "", ct);

        return ok ? Ok(new { ok = true }) : BadRequest(new ApiError(error ?? "No se pudo publicar la respuesta."));
    }

    /// <summary>Vota en una encuesta.</summary>
    [HttpPost("{id:guid}/votar")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Votar(Guid id, [FromBody] VotarApiRequest dto, CancellationToken ct)
    {
        if (dto?.OpcionIds is null || dto.OpcionIds.Count == 0)
            return BadRequest(new ApiError("Selecciona al menos una opción."));

        var post = await comunidad.ObtenerAsync(id, usuario.RequireId(), ct);
        if (post is null) return NotFound();
        if (post.TipoPost != "Encuesta") return BadRequest(new ApiError("Esta publicación no es una encuesta."));

        // Una opción por petición: el toggle (desvotar) lo hace el servicio, así que
        // se llama en bucle para el caso de varias respuestas.
        foreach (var opcionId in dto.OpcionIds)
        {
            if (!Guid.TryParse(opcionId, out var idOpcion)) continue;
            if (!post.Opciones.Any(o => o.OpcionId == idOpcion)) continue;

            var (ok, error) = await comunidad.VotarAsync(usuario.RequireId(), id, idOpcion, ct);
            if (!ok) return BadRequest(new ApiError(error ?? "No se pudo registrar el voto."));
        }

        return Ok(new { ok = true });
    }

    /// <summary>Elimina una publicación propia.</summary>
    [HttpDelete("{id:guid}")]
    [IgnoreAntiforgeryToken]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Eliminar(Guid id, CancellationToken ct)
    {
        var (ok, error) = await comunidad.EliminarPostAsync(usuario.RequireId(), id, ct);
        return ok ? Ok(new { eliminado = true }) : BadRequest(new ApiError(error ?? "No se pudo eliminar."));
    }
}

public record CrearPostApiRequest(string? Titulo, string? Detalle, string? ImagenUrl);

public record CrearEncuestaApiRequest(
    string? Titulo, string? Detalle, List<string>? Opciones, string? ImagenUrl, bool SoloUnaOpcion = true);

public record ResponderApiRequest(string? Texto);

public record VotarApiRequest(List<string>? OpcionIds);

public record PostDto
{
    public Guid PostId { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public string Detalle { get; init; } = string.Empty;
    public string Autor { get; init; } = string.Empty;
    public string? FotoUrl { get; init; }
    public bool EsEncuesta { get; init; }
    public DateTime? Fecha { get; init; }
    public int TotalRespuestas { get; init; }
    public int TotalVotos { get; init; }
}

public record PostDetalleDto
{
    public Guid PostId { get; init; }
    public string Titulo { get; init; } = string.Empty;
    public string Detalle { get; init; } = string.Empty;
    public string Autor { get; init; } = string.Empty;
    public DateTime? Fecha { get; init; }
    public bool EsEncuesta { get; init; }
    public bool SoloUnaOpcion { get; init; }
    public int TotalVotos { get; init; }
    public List<PostOpcionDto> Opciones { get; init; } = [];
    public List<PostRespuestaDto> Respuestas { get; init; } = [];
}

public record PostOpcionDto
{
    public Guid OpcionId { get; init; }
    public string Texto { get; init; } = string.Empty;
    public int TotalVotos { get; init; }
    public bool Seleccionada { get; init; }
}

public record PostRespuestaDto
{
    public Guid RespuestaId { get; init; }
    public string Autor { get; init; } = string.Empty;
    public string Texto { get; init; } = string.Empty;
    public DateTime? Fecha { get; init; }
}