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
    public class ResumenesController : Controller
    {
        private readonly Sugoinotee2Context _context;
        private readonly IConfiguration _config;

        public ResumenesController(Sugoinotee2Context context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<IActionResult> Index()
        {
            var userId = GetUserId();
            var apuntesConResumen = new List<Apunte>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"SELECT ApunteID, TituloNota, ResumenGeneradoIA, FechaRegistro, MateriaID
                                    FROM Apuntes 
                                    WHERE EstudianteID = @uid AND ResumenGeneradoIA IS NOT NULL AND ResumenGeneradoIA != ''
                                    ORDER BY FechaRegistro DESC";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    apuntesConResumen.Add(new Apunte
                    {
                        ApunteId = r.GetGuid(0),
                        TituloNota = r.GetString(1),
                        ResumenGeneradoIA = r.IsDBNull(2) ? null : r.GetString(2),
                        FechaRegistro = r.IsDBNull(3) ? null : r.GetDateTime(3),
                        MateriaId = r.IsDBNull(4) ? null : r.GetGuid(4)
                    });
            }
            finally { await conn.CloseAsync(); }
            return View(apuntesConResumen);
        }

        [HttpGet]
        public async Task<IActionResult> GetApuntes()
        {
            var userId = GetUserId();
            var lista = new List<object>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT ApunteID, TituloNota FROM Apuntes WHERE EstudianteID = @uid ORDER BY FechaRegistro DESC";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    lista.Add(new { apunteId = r.GetGuid(0).ToString(), tituloNota = r.GetString(1) });
            }
            finally { await conn.CloseAsync(); }
            return Json(lista);
        }

        [HttpPost]
        public async Task<IActionResult> Generar([FromBody] GenerarResumenDto dto)
        {
            var userId = GetUserId();
            string contenido = "";
            string titulo = "";

            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT TituloNota, ContenidoTexto FROM Apuntes WHERE ApunteID = @id AND EstudianteID = @uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                {
                    titulo = r.GetString(0);
                    contenido = r.IsDBNull(1) ? "" : r.GetString(1);
                    contenido = System.Text.RegularExpressions.Regex.Replace(contenido, "<.*?>", " ");
                }
            }
            finally { await conn.CloseAsync(); }

            if (string.IsNullOrWhiteSpace(contenido))
                return BadRequest(new { error = "El apunte no tiene contenido para resumir." });

            string resumen = await GenerarConIA(titulo, contenido);

            var conn2 = _context.Database.GetDbConnection();
            try
            {
                if (conn2.State != ConnectionState.Open) await conn2.OpenAsync();
                using var cmd = conn2.CreateCommand();
                cmd.CommandText = "UPDATE Apuntes SET ResumenGeneradoIA = @r WHERE ApunteID = @id AND EstudianteID = @uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@r", resumen));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn2.CloseAsync(); }

            return Ok(new { resumen, titulo });
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerResumen(Guid apunteId)
        {
            var userId = GetUserId();
            string resumen = "";
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT ResumenGeneradoIA FROM Apuntes WHERE ApunteID = @id AND EstudianteID = @uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", apunteId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                var r = await cmd.ExecuteScalarAsync();
                resumen = r?.ToString() ?? "";
            }
            finally { await conn.CloseAsync(); }
            return Json(new { resumen });
        }

        private async Task<string> GenerarConIA(string titulo, string contenido)
        {
            try
            {
                var apiKey = _config["Anthropic:ApiKey"];
                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("x-api-key", apiKey);
                http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                var prompt = $@"Eres un tutor académico experto. Genera un resumen detallado y bien estructurado del siguiente apunte escolar.

Título: {titulo}
Contenido: {contenido.Substring(0, Math.Min(contenido.Length, 4000))}

Responde SOLO con HTML limpio usando estas etiquetas: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <code>.
No incluyas markdown como bloques de código. Solo el contenido HTML.";

                var body = new
                {
                    model = "claude-haiku-4-5",
                    max_tokens = 1000,
                    messages = new[] { new { role = "user", content = prompt } }
                };

                var response = await http.PostAsync(
                    "https://api.anthropic.com/v1/messages",
                    new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
                );

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("error", out var err))
                    return $"<p>Error de Claude: {err.GetProperty("message").GetString()}</p>";

                var resultado = root
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString() ?? "Error al generar resumen.";

                resultado = resultado.Replace("```html", "").Replace("```", "").Trim();
                return resultado;
            }
            catch (Exception ex)
            {
                return $"<p>Error interno: {ex.Message}</p>";
            }
        }

        private Guid GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return Guid.Parse(claim!.Value);
        }
    }

    public class GenerarResumenDto
    {
        public string? ApunteId { get; set; }
    }
}