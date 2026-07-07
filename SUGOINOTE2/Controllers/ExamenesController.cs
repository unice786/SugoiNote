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
    public class ExamenesController : Controller
    {
        private readonly Sugoinotee2Context _context;
        private readonly IConfiguration _config;

        public ExamenesController(Sugoinotee2Context context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<IActionResult> Index()
        {
            var userId = GetUserId();
            var examenes = new List<ExamenVM>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"SELECT e.ExamenID, a.TituloNota, e.CalificacionFinal, e.FechaRealizacion
                                    FROM Examenes e
                                    INNER JOIN Apuntes a ON e.ApunteID = a.ApunteID
                                    WHERE a.EstudianteID = @uid
                                    ORDER BY e.FechaRealizacion DESC";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    examenes.Add(new ExamenVM
                    {
                        ExamenId = r.GetGuid(0),
                        TituloApunte = r.GetString(1),
                        Calificacion = r.IsDBNull(2) ? null : r.GetDecimal(2),
                        Fecha = r.IsDBNull(3) ? null : r.GetDateTime(3)
                    });
            }
            finally { await conn.CloseAsync(); }
            return View(examenes);
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
        public async Task<IActionResult> Generar([FromBody] GenerarExamenDto dto)
        {
            var userId = GetUserId();
            string contenido = "", titulo = "";

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
                return BadRequest(new { error = "El apunte no tiene contenido." });

            var preguntas = await GenerarPreguntasIA(contenido, dto.TipoRespuesta!, dto.CantidadPreguntas);

            if (preguntas.Count == 0)
                return BadRequest(new { error = "No se pudieron generar preguntas. Intenta de nuevo." });

            var examenId = Guid.NewGuid();
            var conn2 = _context.Database.GetDbConnection();
            try
            {
                if (conn2.State != ConnectionState.Open) await conn2.OpenAsync();

                using var cmdE = conn2.CreateCommand();
                cmdE.CommandText = "INSERT INTO Examenes (ExamenID, ApunteID, FechaRealizacion) VALUES (@eid, @aid, @f)";
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", examenId));
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@aid", Guid.Parse(dto.ApunteId!)));
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@f", DateTime.Now));
                await cmdE.ExecuteNonQueryAsync();

                foreach (var p in preguntas)
                {
                    var pregId = Guid.NewGuid();
                    using var cmdP = conn2.CreateCommand();
                    cmdP.CommandText = "INSERT INTO Preguntas (PreguntaID, ExamenID, TextoPregunta) VALUES (@pid, @eid, @t)";
                    cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@pid", pregId));
                    cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", examenId));
                    cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", p.Pregunta));
                    await cmdP.ExecuteNonQueryAsync();

                    foreach (var op in p.Opciones)
                    {
                        using var cmdO = conn2.CreateCommand();
                        cmdO.CommandText = "INSERT INTO OpcionesRespuesta (OpcionID, PreguntaID, TextoOpcion, EsLaCorrecta) VALUES (@oid, @pid, @t, @c)";
                        cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@oid", Guid.NewGuid()));
                        cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@pid", pregId));
                        cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", op.Texto));
                        cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@c", op.EsCorrecta));
                        await cmdO.ExecuteNonQueryAsync();
                    }
                }
            }
            finally { await conn2.CloseAsync(); }

            return Ok(new { examenId = examenId.ToString(), titulo });
        }

        [HttpGet]
        public async Task<IActionResult> Ver(Guid id)
        {
            var userId = GetUserId();
            var vm = new ExamenDetalleVM();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmdE = conn.CreateCommand();
                cmdE.CommandText = @"SELECT e.ExamenID, a.TituloNota, e.CalificacionFinal
                                     FROM Examenes e INNER JOIN Apuntes a ON e.ApunteID = a.ApunteID
                                     WHERE e.ExamenID = @id AND a.EstudianteID = @uid";
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", id));
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));

                using var rE = await cmdE.ExecuteReaderAsync();
                if (await rE.ReadAsync())
                {
                    vm.ExamenId = rE.GetGuid(0);
                    vm.TituloApunte = rE.GetString(1);
                    vm.Calificacion = rE.IsDBNull(2) ? null : rE.GetDecimal(2);
                }
                await rE.CloseAsync();

                using var cmdP = conn.CreateCommand();
                cmdP.CommandText = "SELECT PreguntaID, TextoPregunta, RespuestaSeleccionadaID FROM Preguntas WHERE ExamenID = @id ORDER BY PreguntaID";
                cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", id));

                using var rP = await cmdP.ExecuteReaderAsync();
                while (await rP.ReadAsync())
                {
                    vm.Preguntas.Add(new PreguntaVM
                    {
                        PreguntaId = rP.GetGuid(0),
                        Texto = rP.GetString(1),
                        RespuestaSeleccionadaId = rP.IsDBNull(2) ? null : rP.GetGuid(2)
                    });
                }
                await rP.CloseAsync();
            }
            finally { await conn.CloseAsync(); }

            foreach (var preg in vm.Preguntas)
            {
                var conn3 = _context.Database.GetDbConnection();
                try
                {
                    if (conn3.State != ConnectionState.Open) await conn3.OpenAsync();
                    using var cmdO = conn3.CreateCommand();
                    cmdO.CommandText = "SELECT OpcionID, TextoOpcion, EsLaCorrecta FROM OpcionesRespuesta WHERE PreguntaID = @pid";
                    cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@pid", preg.PreguntaId));
                    using var rO = await cmdO.ExecuteReaderAsync();
                    while (await rO.ReadAsync())
                        preg.Opciones.Add(new OpcionVM
                        {
                            OpcionId = rO.GetGuid(0),
                            Texto = rO.GetString(1),
                            EsCorrecta = rO.GetBoolean(2)
                        });
                }
                finally { await conn3.CloseAsync(); }
            }

            return View(vm);
        }

        [HttpPost]
        public async Task<IActionResult> Calificar([FromBody] CalificarDto dto)
        {
            var userId = GetUserId();
            int correctas = 0;
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmdCheck = conn.CreateCommand();
                cmdCheck.CommandText = @"SELECT e.CalificacionFinal FROM Examenes e 
                                         INNER JOIN Apuntes a ON e.ApunteID = a.ApunteID
                                         WHERE e.ExamenID = @eid AND a.EstudianteID = @uid";
                cmdCheck.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", Guid.Parse(dto.ExamenId!)));
                cmdCheck.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                var yaCalificado = await cmdCheck.ExecuteScalarAsync();
                if (yaCalificado != null && yaCalificado != DBNull.Value)
                    return BadRequest(new { error = "Este examen ya fue entregado." });

                foreach (var r in dto.Respuestas!)
                {
                    using var cmdC = conn.CreateCommand();
                    cmdC.CommandText = "SELECT EsLaCorrecta FROM OpcionesRespuesta WHERE OpcionID = @oid";
                    cmdC.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@oid", Guid.Parse(r.OpcionId!)));
                    var res = await cmdC.ExecuteScalarAsync();
                    if (res != null && (bool)res) correctas++;

                    using var cmdU = conn.CreateCommand();
                    cmdU.CommandText = "UPDATE Preguntas SET RespuestaSeleccionadaID = @oid WHERE PreguntaID = @pid";
                    cmdU.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@oid", Guid.Parse(r.OpcionId!)));
                    cmdU.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@pid", Guid.Parse(r.PreguntaId!)));
                    await cmdU.ExecuteNonQueryAsync();
                }

                decimal calificacion = dto.Respuestas.Count > 0
                    ? Math.Round(((decimal)correctas / dto.Respuestas.Count) * 100, 2)
                    : 0;

                using var cmdCal = conn.CreateCommand();
                cmdCal.CommandText = "UPDATE Examenes SET CalificacionFinal = @cal WHERE ExamenID = @eid";
                cmdCal.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@cal", calificacion));
                cmdCal.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", Guid.Parse(dto.ExamenId!)));
                await cmdCal.ExecuteNonQueryAsync();

                return Ok(new { calificacion, correctas, total = dto.Respuestas.Count });
            }
            finally { await conn.CloseAsync(); }
        }

        private async Task<List<PreguntaGeneradaDto>> GenerarPreguntasIA(string contenido, string tipo, int cantidad)
        {
            try
            {
                var apiKey = _config["Anthropic:ApiKey"];
                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("x-api-key", apiKey);
                http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");

                string instruccion = tipo == "verdadero_falso"
                    ? $"Genera {cantidad} preguntas de Verdadero o Falso con opciones 'Verdadero' y 'Falso'."
                    : $"Genera {cantidad} preguntas de opción múltiple con 4 opciones. Solo una correcta.";

                var contenidoCorto = contenido.Substring(0, Math.Min(contenido.Length, 1500));

                var prompt = $@"Eres un profesor estructurando un examen. {instruccion}
Contenido del apunte: {contenidoCorto}

Debes responder ESTRICTAMENTE con un arreglo JSON válido. No incluyas texto extra, ni saludos, ni bloques de código markdown.
El formato exacto debe ser este:
[
  {{
    ""pregunta"": ""texto de la pregunta"",
    ""opciones"": [
      {{ ""texto"": ""opcion 1"", ""esCorrecta"": false }},
      {{ ""texto"": ""opcion 2"", ""esCorrecta"": true }}
    ]
  }}
]";

                var body = new
                {
                    model = "claude-haiku-4-5",
                    max_tokens = 1500,
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
                {
                    Console.WriteLine($"Error de Claude: {err.GetProperty("message").GetString()}");
                    return new List<PreguntaGeneradaDto>();
                }

                string texto = root
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString() ?? "[]";

                texto = texto.Replace("```json", "").Replace("```", "").Trim();

                var inicio = texto.IndexOf('[');
                var fin = texto.LastIndexOf(']');
                if (inicio >= 0 && fin > inicio)
                    texto = texto.Substring(inicio, fin - inicio + 1);

                return JsonSerializer.Deserialize<List<PreguntaGeneradaDto>>(texto,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<PreguntaGeneradaDto>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error parseando JSON de Claude: {ex.Message}");
                return new List<PreguntaGeneradaDto>();
            }
        }

        private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    public class GenerarExamenDto
    {
        public string? ApunteId { get; set; }
        public string? TipoRespuesta { get; set; }
        public int CantidadPreguntas { get; set; } = 10;
    }

    public class CalificarDto
    {
        public string? ExamenId { get; set; }
        public List<RespuestaDto>? Respuestas { get; set; }
    }

    public class RespuestaDto
    {
        public string? PreguntaId { get; set; }
        public string? OpcionId { get; set; }
    }

    public class PreguntaGeneradaDto
    {
        public string Pregunta { get; set; } = "";
        public List<OpcionGeneradaDto> Opciones { get; set; } = new();
    }

    public class OpcionGeneradaDto
    {
        public string Texto { get; set; } = "";
        public bool EsCorrecta { get; set; }
    }

    public class ExamenVM
    {
        public Guid ExamenId { get; set; }
        public string TituloApunte { get; set; } = "";
        public decimal? Calificacion { get; set; }
        public DateTime? Fecha { get; set; }
    }

    public class ExamenDetalleVM
    {
        public Guid ExamenId { get; set; }
        public string TituloApunte { get; set; } = "";
        public decimal? Calificacion { get; set; }
        public List<PreguntaVM> Preguntas { get; set; } = new();
    }

    public class PreguntaVM
    {
        public Guid PreguntaId { get; set; }
        public string Texto { get; set; } = "";
        public Guid? RespuestaSeleccionadaId { get; set; }
        public List<OpcionVM> Opciones { get; set; } = new();
    }

    public class OpcionVM
    {
        public Guid OpcionId { get; set; }
        public string Texto { get; set; } = "";
        public bool EsCorrecta { get; set; }
    }
}