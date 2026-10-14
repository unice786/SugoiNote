using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Services.Chat;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers.Api;

/// <summary>Chat con el asistente de IA.</summary>
[ApiController]
[Route("api/chat")]
[Authorize]
[Produces("application/json")]
public class ApiChatController(IChatService chat, ICurrentUser usuario) : ControllerBase
{
    /// <summary>Envía un mensaje y recibe la respuesta de la IA.</summary>
    [HttpPost("enviar")]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("IA")]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Enviar([FromBody] ChatApiRequest dto, CancellationToken ct)
    {
        if (dto is null || string.IsNullOrWhiteSpace(dto.Mensaje))
            return BadRequest(new ApiError("Escribe un mensaje antes de enviar."));

        var (ok, respuesta, error) = await chat.ResponderAsync(usuario.RequireId(), dto.Mensaje, null, ct);

        return ok ? Ok(new { respuesta }) : BadRequest(new ApiError(error ?? "No se pudo obtener respuesta."));
    }
}

public record ChatApiRequest(string? Mensaje);