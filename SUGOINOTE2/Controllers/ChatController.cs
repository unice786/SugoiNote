using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Chat;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers;

[Authorize]
public class ChatController(IChatService chat, ICurrentUser usuario) : Controller
{
    [HttpGet]
    public IActionResult Index() => View();

    [HttpPost]
    [EnableRateLimiting("IA")]
    public async Task<IActionResult> Enviar([FromBody] ChatMensajeDto dto, CancellationToken ct)
    {
        if (dto is null || (string.IsNullOrWhiteSpace(dto.Mensaje) && string.IsNullOrWhiteSpace(dto.Imagen)))
            return BadRequest(new { error = "Escribe un mensaje antes de enviar." });

        // FIX: antes devolvía Ok() con HTTP 200 y el texto "Error técnico: {ex.Message}",
        // así que el cliente nunca detectaba el fallo.
        var (ok, respuesta, error) = await chat.ResponderAsync(usuario.RequireId(), dto.Mensaje ?? "", dto.Imagen, ct);

        return ok ? Ok(new { respuesta }) : BadRequest(new { error });
    }
}