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
            if (!Guid.TryParse(userIdClaim.Value, out var userId))
                return RedirectToAction("Login", "Auth");

            var apuntes = new List<Apunte>();
            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT ApunteID, TituloNota, ContenidoTexto, FechaRegistro, EstudianteID
                    FROM Apuntes
                    WHERE EstudianteID = @uid
                    ORDER BY FechaRegistro DESC";
                var p = cmd.CreateParameter();
                p.ParameterName = "@uid"; p.Value = userId;
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading apuntes for user {UserId}", userId);
                ModelState.AddModelError(string.Empty, "Error al cargar apuntes: " + ex.Message);
            }

            return View("~/Views/Home/Index.cshtml", apuntes);
        }

        [HttpGet]
        public async Task<IActionResult> Create()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return RedirectToAction("Login", "Auth");
            if (!Guid.TryParse(userIdClaim.Value, out var userId))
                return RedirectToAction("Login", "Auth");

            var materias = new List<Materia>();
            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT MaterialID, NombreMateria, EstudianteID
                    FROM Materias
                    WHERE EstudianteID = @uid
                    ORDER BY NombreMateria";
                var p = cmd.CreateParameter();
                p.ParameterName = "@uid"; p.Value = userId;
                cmd.Parameters.Add(p);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    materias.Add(new Materia
                    {
                        MateriaId = reader.GetGuid(0),
                        NombreMateria = reader.GetString(1),
                        EstudianteId = reader.GetGuid(2)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading materias for user {UserId}", userId);
            }

            ViewBag.Materias = materias;
            return View("Create", new Apunte());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Apunte model, string? newMateriaName)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return RedirectToAction("Login", "Auth");
            if (!Guid.TryParse(userIdClaim.Value, out var userId))
                return RedirectToAction("Login", "Auth");

            if (!ModelState.IsValid)
            {
                ViewBag.Materias = new List<Materia>();
                return View("Create", model);
            }

            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // Si hay nueva materia, insertarla primero
                if (!string.IsNullOrWhiteSpace(model.newMateriaName))
                {
                    var nuevaMateriaId = Guid.NewGuid();
                    using var cmdMateria = conn.CreateCommand();
                    cmdMateria.CommandText = @"
                        INSERT INTO Materias (MateriaID, NombreMateria, EstudianteID)
                        VALUES (@mid, @nombre, @eid)";

                    var p1 = cmdMateria.CreateParameter();
                    p1.ParameterName = "@mid"; p1.Value = nuevaMateriaId;
                    var p2 = cmdMateria.CreateParameter();
                    p2.ParameterName = "@nombre"; p2.Value = model.newMateriaName;
                    var p3 = cmdMateria.CreateParameter();
                    p3.ParameterName = "@eid"; p3.Value = userId;
                    cmdMateria.Parameters.Add(p1);
                    cmdMateria.Parameters.Add(p2);
                    cmdMateria.Parameters.Add(p3);
                    await cmdMateria.ExecuteNonQueryAsync();
                    model.MateriaId = nuevaMateriaId;
                }

                // Insertar el apunte
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO Apuntes (ApunteID, TituloNota, ContenidoTexto, MateriaID, EstudianteID, FechaRegistro)
                    VALUES (@id, @titulo, @contenido, @materia, @estudiante, @fecha)";

                var pa1 = cmd.CreateParameter();
                pa1.ParameterName = "@id"; pa1.Value = Guid.NewGuid();
                var pa2 = cmd.CreateParameter();
                pa2.ParameterName = "@titulo"; pa2.Value = model.TituloNota;
                var pa3 = cmd.CreateParameter();
                pa3.ParameterName = "@contenido"; pa3.Value = (object?)model.ContenidoTexto ?? DBNull.Value;
                var pa4 = cmd.CreateParameter();
                pa4.ParameterName = "@materia"; pa4.Value = (object?)model.MateriaId ?? DBNull.Value;
                var pa5 = cmd.CreateParameter();
                pa5.ParameterName = "@estudiante"; pa5.Value = userId;
                var pa6 = cmd.CreateParameter();
                pa6.ParameterName = "@fecha"; pa6.Value = DateTime.UtcNow;

                cmd.Parameters.Add(pa1);
                cmd.Parameters.Add(pa2);
                cmd.Parameters.Add(pa3);
                cmd.Parameters.Add(pa4);
                cmd.Parameters.Add(pa5);
                cmd.Parameters.Add(pa6);

                await cmd.ExecuteNonQueryAsync();

                _logger.LogInformation("Apunte creado por usuario {UserId}", userId);
                TempData["Success"] = "Apunte guardado correctamente.";
                return RedirectToAction("Index");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving apunte for user {UserId}", userId);
                ModelState.AddModelError(string.Empty, ex.ToString());
                ViewBag.Materias = new List<Materia>();
                return View("Create", model);
            }
        }
    }
}