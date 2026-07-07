using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Security.Claims;
using System.Data;

namespace SugoiNote.Controllers
{
    [Authorize]
    public class ApuntesController : Controller
    {
        private readonly Sugoinotee2Context _context;
        private readonly ILogger<ApuntesController> _logger;

        public ApuntesController(Sugoinotee2Context context, ILogger<ApuntesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IActionResult> Index()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return RedirectToAction("Login", "Auth");
            Guid userId = Guid.Parse(userIdClaim.Value);

            var apuntes = new List<Apunte>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"SELECT ApunteID, TituloNota, ContenidoTexto, FechaRegistro, EstudianteID 
                                  FROM Apuntes WHERE EstudianteID = @uid ORDER BY FechaRegistro DESC";
                var p = cmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = userId;
                cmd.Parameters.Add(p);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    apuntes.Add(new Apunte
                    {
                        ApunteId = reader.GetGuid(0),
                        TituloNota = reader.GetString(1),
                        ContenidoTexto = reader.IsDBNull(2) ? null : reader.GetString(2),
                        FechaRegistro = reader.IsDBNull(3) ? null : reader.GetDateTime(3),
                        EstudianteId = reader.GetGuid(4)
                    });
                }
            }
            finally { await conn.CloseAsync(); }

            return View("~/Views/Home/Index.cshtml", apuntes);
        }

        [HttpGet]
        public async Task<IActionResult> Create()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            Guid userId = Guid.Parse(userIdClaim.Value);
            var materias = new List<Materia>();

            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT MateriaID, NombreMateria FROM Materias WHERE EstudianteID = @uid";
                var p = cmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = userId;
                cmd.Parameters.Add(p);
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    materias.Add(new Materia { MateriaId = r.GetGuid(0), NombreMateria = r.GetString(1) });
            }
            finally { await conn.CloseAsync(); }

            ViewBag.Materias = materias;
            return View(new Apunte());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Apunte model)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            Guid userId = Guid.Parse(userIdClaim.Value);

            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                if (!string.IsNullOrWhiteSpace(model.newMateriaName))
                {
                    var mid = Guid.NewGuid();
                    using var cmdM = conn.CreateCommand();
                    cmdM.CommandText = "INSERT INTO Materias (MateriaID, NombreMateria, EstudianteID) VALUES (@mid, @n, @eid)";
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@mid", mid));
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@n", model.newMateriaName));
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", userId));
                    await cmdM.ExecuteNonQueryAsync();
                    model.MateriaId = mid;
                }

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"INSERT INTO Apuntes (ApunteID, TituloNota, ContenidoTexto, MateriaID, EstudianteID, FechaRegistro) 
                                  VALUES (@id, @t, @c, @m, @e, @f)";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.NewGuid()));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", model.TituloNota));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@c", (object)model.ContenidoTexto ?? DBNull.Value));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@m", (object)model.MateriaId ?? DBNull.Value));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@e", userId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@f", DateTime.Now));

                await cmd.ExecuteNonQueryAsync();
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.ToString());
                return View(model);
            }
            finally { await conn.CloseAsync(); }
        }

        [HttpGet]
        public async Task<IActionResult> GetMaterias()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Json(new List<object>());
            Guid userId = Guid.Parse(userIdClaim.Value);

            var materias = new List<object>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT MateriaID, NombreMateria FROM Materias WHERE EstudianteID = @uid ORDER BY NombreMateria";
                var p = cmd.CreateParameter(); p.ParameterName = "@uid"; p.Value = userId;
                cmd.Parameters.Add(p);
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    materias.Add(new { materiaId = r.GetGuid(0).ToString(), nombreMateria = r.GetString(1) });
            }
            finally { await conn.CloseAsync(); }
            return Json(materias);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateRapido(Apunte model)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            Guid userId = Guid.Parse(userIdClaim!.Value);
            var conn = _context.Database.GetDbConnection();
            var newId = Guid.NewGuid();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                if (!string.IsNullOrWhiteSpace(model.newMateriaName))
                {
                    var mid = Guid.NewGuid();
                    using var cmdM = conn.CreateCommand();
                    cmdM.CommandText = "INSERT INTO Materias (MateriaID, NombreMateria, EstudianteID) VALUES (@mid, @n, @eid)";
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@mid", mid));
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@n", model.newMateriaName));
                    cmdM.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@eid", userId));
                    await cmdM.ExecuteNonQueryAsync();
                    model.MateriaId = mid;
                }
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "INSERT INTO Apuntes (ApunteID, TituloNota, ContenidoTexto, MateriaID, EstudianteID, FechaRegistro) VALUES (@id,@t,@c,@m,@e,@f)";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", newId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", model.TituloNota));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@c", DBNull.Value));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@m", (object?)model.MateriaId ?? DBNull.Value));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@e", userId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@f", DateTime.Now));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }
            return RedirectToAction("Editor", new { id = newId });
        }

        [HttpGet]
        public async Task<IActionResult> Editor(Guid id)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return RedirectToAction("Login", "Auth");
            Guid userId = Guid.Parse(userIdClaim.Value);

            Apunte? apunte = null;
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT ApunteID, TituloNota, ContenidoTexto, FechaRegistro, EstudianteID FROM Apuntes WHERE ApunteID = @id AND EstudianteID = @uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", id));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var r = await cmd.ExecuteReaderAsync();
                if (await r.ReadAsync())
                {
                    apunte = new Apunte
                    {
                        ApunteId = r.GetGuid(0),
                        TituloNota = r.GetString(1),
                        ContenidoTexto = r.IsDBNull(2) ? null : r.GetString(2),
                        FechaRegistro = r.IsDBNull(3) ? null : r.GetDateTime(3),
                        EstudianteId = r.GetGuid(4)
                    };
                }
            }
            finally { await conn.CloseAsync(); }

            if (apunte == null) return NotFound();
            return View(apunte);
        }

        [HttpPost]
        public async Task<IActionResult> AutoSave([FromBody] AutoSaveDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            Guid userId = Guid.Parse(userIdClaim.Value);

            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "UPDATE Apuntes SET TituloNota=@t, ContenidoTexto=@c WHERE ApunteID=@id AND EstudianteID=@uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", dto.Titulo ?? ""));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@c", (object?)dto.Contenido ?? DBNull.Value));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }
            return Ok();
        }

        [HttpPost]
        public async Task<IActionResult> Eliminar([FromBody] EliminarApunteDto dto)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();
            Guid userId = Guid.Parse(userIdClaim.Value);

            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmdO = conn.CreateCommand();
                cmdO.CommandText = @"DELETE o FROM OpcionesRespuesta o
                                    INNER JOIN Preguntas p ON o.PreguntaID = p.PreguntaID
                                    INNER JOIN Examenes e ON p.ExamenID = e.ExamenID
                                    WHERE e.ApunteID = @id";
                cmdO.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                await cmdO.ExecuteNonQueryAsync();

                using var cmdP = conn.CreateCommand();
                cmdP.CommandText = @"DELETE p FROM Preguntas p
                                    INNER JOIN Examenes e ON p.ExamenID = e.ExamenID
                                    WHERE e.ApunteID = @id";
                cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                await cmdP.ExecuteNonQueryAsync();

                using var cmdE = conn.CreateCommand();
                cmdE.CommandText = "DELETE FROM Examenes WHERE ApunteID = @id";
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                await cmdE.ExecuteNonQueryAsync();

                using var cmdA = conn.CreateCommand();
                cmdA.CommandText = "DELETE FROM Apuntes WHERE ApunteID = @id AND EstudianteID = @uid";
                cmdA.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.Parse(dto.ApunteId!)));
                cmdA.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                await cmdA.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }

            return Ok(new { ok = true });
        }
    }
}

public class AutoSaveDto
{
    public string? ApunteId { get; set; }
    public string? Titulo { get; set; }
    public string? Contenido { get; set; }
}

public class EliminarApunteDto
{
    public string? ApunteId { get; set; }
}