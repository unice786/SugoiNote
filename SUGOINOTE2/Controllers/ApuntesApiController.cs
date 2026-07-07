using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace SugoiNote.Controllers
{
    [Authorize]
    [Route("api/apuntes")]
    [ApiController]
    public class ApuntesApiController : ControllerBase
    {
        private readonly Sugoinotee2Context _context;
        private readonly ILogger<ApuntesApiController> _logger;

        public ApuntesApiController(Sugoinotee2Context context, ILogger<ApuntesApiController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpPost("resumir")]
        public async Task<IActionResult> Resumir([FromBody] ResumirRequest req)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            if (!Guid.TryParse(userIdClaim.Value, out var userId)) return Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Contenido))
                return BadRequest(new { error = "El apunte no tiene contenido para resumir." });

            try
            {
                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("x-api-key", "TU_API_KEY_AQUI");
                http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                var prompt = $"Eres un asistente educativo. Resume el siguiente apunte de manera clara y concisa, destacando los puntos más importantes.\n\nTítulo: {req.Titulo}\n\nContenido:\n{req.Contenido}\n\nProporciona un resumen estructurado con los puntos clave.";

                var body = new
                {
                    model = "claude-sonnet-4-20250514",
                    max_tokens = 1000,
                    messages = new[] { new { role = "user", content = prompt } }
                };

                var json = JsonSerializer.Serialize(body);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await http.PostAsync("https://api.anthropic.com/v1/messages", content);
                var responseText = await response.Content.ReadAsStringAsync();

                using var doc = JsonDocument.Parse(responseText);
                var resumen = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString();

                if (string.IsNullOrEmpty(resumen))
                    return StatusCode(500, new { error = "No se pudo generar el resumen." });

                // Guardar en BD
                var conn = _context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "UPDATE Apuntes SET ResumenGeneradoIA = @resumen WHERE ApunteID = @id AND EstudianteID = @uid";
                var p1 = cmd.CreateParameter(); p1.ParameterName = "@resumen"; p1.Value = resumen;
                var p2 = cmd.CreateParameter(); p2.ParameterName = "@id"; p2.Value = req.ApunteId;
                var p3 = cmd.CreateParameter(); p3.ParameterName = "@uid"; p3.Value = userId;
                cmd.Parameters.Add(p1); cmd.Parameters.Add(p2); cmd.Parameters.Add(p3);
                await cmd.ExecuteNonQueryAsync();

                return Ok(new { resumen });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating summary");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class ResumirRequest
    {
        public Guid ApunteId { get; set; }
        public string Titulo { get; set; } = "";
        public string Contenido { get; set; } = "";
    }
}