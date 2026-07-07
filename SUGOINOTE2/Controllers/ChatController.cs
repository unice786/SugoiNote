using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Data;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace SugoiNote.Controllers
{
    [Authorize]
    public class ChatController : Controller
    {
        private readonly IConfiguration _config;
        private readonly Sugoinotee2Context _context;

        public ChatController(IConfiguration config, Sugoinotee2Context context)
        {
            _config = config;
            _context = context;
        }

        [HttpGet]
        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        [Route("api/Chat")]
        [Route("Chat/Enviar")]
        public async Task<IActionResult> Enviar([FromBody] ChatMensajeDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Mensaje))
                return Ok(new { respuesta = "Mensaje vacío. Por favor escribe algo." });

            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                    return Ok(new { respuesta = "Error: Sesión no encontrada o expirada. Vuelve a iniciar sesión." });

                var apiKey = _config["Anthropic:ApiKey"];
                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("x-api-key", apiKey);
                http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                string contextoEstudiante = await ObtenerContextoEstudiante(userId);

                var body = new
                {
                    model = "claude-haiku-4-5",
                    max_tokens = 800,
                    system = $@"Eres SugoiAI, un tutor académico inteligente en SugoiNote. 
Ayuda al estudiante con sus dudas. Responde siempre en español.
Usa estos apuntes del estudiante para dar resúmenes y respuestas personalizadas:
{contextoEstudiante}",
                    messages = new[]
                    {
                        new { role = "user", content = dto.Mensaje }
                    }
                };

                var response = await http.PostAsync(
                    "https://api.anthropic.com/v1/messages",
                    new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
                );

                var json = await response.Content.ReadAsStringAsync();

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("error", out var err))
                {
                    var msjError = err.GetProperty("message").GetString();
                    return Ok(new { respuesta = $"Error de Claude: {msjError}" });
                }

                var respuesta = root
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString() ?? "No pude generar una respuesta.";

                return Ok(new { respuesta });
            }
            catch (Exception ex)
            {
                return Ok(new { respuesta = $"Error técnico interno: {ex.Message}" });
            }
        }

        private async Task<string> ObtenerContextoEstudiante(string userId)
        {
            var sb = new StringBuilder();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmdN = conn.CreateCommand();
                cmdN.CommandText = "SELECT NombreCompleto FROM Estudiantes WHERE EstudianteID = @uid";
                var pUid1 = cmdN.CreateParameter();
                pUid1.ParameterName = "@uid";
                pUid1.Value = userId;
                cmdN.Parameters.Add(pUid1);

                var nombre = await cmdN.ExecuteScalarAsync();
                sb.AppendLine($"Estudiante: {nombre}");

                using var cmdA = conn.CreateCommand();
                cmdA.CommandText = @"SELECT TOP 5 TituloNota, ContenidoTexto 
                                     FROM Apuntes WHERE EstudianteID = @uid 
                                     ORDER BY FechaRegistro DESC";
                var pUid2 = cmdA.CreateParameter();
                pUid2.ParameterName = "@uid";
                pUid2.Value = userId;
                cmdA.Parameters.Add(pUid2);

                using var rA = await cmdA.ExecuteReaderAsync();
                sb.AppendLine("\nApuntes recientes del estudiante:");
                while (await rA.ReadAsync())
                {
                    var titulo = rA.GetString(0);
                    var contenido = rA.IsDBNull(1) ? "(vacío)" : rA.GetString(1);
                    contenido = System.Text.RegularExpressions.Regex.Replace(contenido, "<.*?>", " ");
                    contenido = contenido.Length > 250 ? contenido.Substring(0, 250) + "..." : contenido;
                    sb.AppendLine($"- {titulo}: {contenido}");
                }
            }
            finally
            {
                await conn.CloseAsync();
            }

            return sb.ToString();
        }
    }

    public class ChatMensajeDto
    {
        public string Mensaje { get; set; } = string.Empty;
        public List<MensajeHistorial>? Historial { get; set; }
    }

    public class MensajeHistorial
    {
        public string Texto { get; set; } = string.Empty;
        public bool EsUsuario { get; set; }
    }
}