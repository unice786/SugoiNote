using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Security.Claims;
using System.Data;

namespace SugoiNote.Controllers
{
    public class HomeController : Controller
    {
        private readonly Sugoinotee2Context _context;
        public HomeController(Sugoinotee2Context context) { _context = context; }

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
                // SQL Manual para evitar el error de "MateriaID"
                cmd.CommandText = "SELECT TOP 4 ApunteID, TituloNota, FechaRegistro FROM Apuntes WHERE EstudianteID = @u ORDER BY FechaRegistro DESC";
                var p = cmd.CreateParameter(); p.ParameterName = "@u"; p.Value = userId;
                cmd.Parameters.Add(p);

                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    apuntes.Add(new Apunte
                    {
                        ApunteId = r.GetGuid(0),
                        TituloNota = r.GetString(1),
                        FechaRegistro = r.IsDBNull(2) ? null : r.GetDateTime(2)
                    });
                }
            }
            finally { await conn.CloseAsync(); }

            ViewBag.NombreReal = User.Identity.Name ?? "Usuario";
            return View(apuntes);
        }
    }
}