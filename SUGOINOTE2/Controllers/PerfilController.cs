using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Data;
using System.Security.Claims;

namespace SugoiNote.Controllers
{
    [Authorize]
    public class PerfilController : Controller
    {
        private readonly Sugoinotee2Context _context;

        public PerfilController(Sugoinotee2Context context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            var userId = GetUserId();
            var vm = new PerfilVM();

            // Query 1 — datos del estudiante
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmdE = conn.CreateCommand();
                cmdE.CommandText = "SELECT NombreCompleto, CorreoElectronico FROM Estudiantes WHERE EstudianteID = @uid";
                cmdE.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                using var rE = await cmdE.ExecuteReaderAsync();
                if (await rE.ReadAsync())
                {
                    vm.NombreCompleto = rE.GetString(0);
                    vm.Correo = rE.GetString(1);
                }
            }
            finally { await conn.CloseAsync(); }

            // Query 2 — total apuntes
            var conn2 = _context.Database.GetDbConnection();
            try
            {
                if (conn2.State != ConnectionState.Open) await conn2.OpenAsync();
                using var cmdA = conn2.CreateCommand();
                cmdA.CommandText = "SELECT COUNT(*) FROM Apuntes WHERE EstudianteID = @uid";
                cmdA.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                vm.TotalApuntes = (int)(await cmdA.ExecuteScalarAsync() ?? 0);
            }
            finally { await conn2.CloseAsync(); }

            // Query 3 — total resumenes
            var conn3 = _context.Database.GetDbConnection();
            try
            {
                if (conn3.State != ConnectionState.Open) await conn3.OpenAsync();
                using var cmdR = conn3.CreateCommand();
                cmdR.CommandText = "SELECT COUNT(*) FROM Apuntes WHERE EstudianteID = @uid AND ResumenGeneradoIA IS NOT NULL AND ResumenGeneradoIA != ''";
                cmdR.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                vm.TotalResumenes = (int)(await cmdR.ExecuteScalarAsync() ?? 0);
            }
            finally { await conn3.CloseAsync(); }

            // Query 4 — total examenes
            var conn4 = _context.Database.GetDbConnection();
            try
            {
                if (conn4.State != ConnectionState.Open) await conn4.OpenAsync();
                using var cmdEx = conn4.CreateCommand();
                cmdEx.CommandText = @"SELECT COUNT(*) FROM Examenes e 
                                      INNER JOIN Apuntes a ON e.ApunteID = a.ApunteID 
                                      WHERE a.EstudianteID = @uid";
                cmdEx.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                vm.TotalExamenes = (int)(await cmdEx.ExecuteScalarAsync() ?? 0);
            }
            finally { await conn4.CloseAsync(); }

            // Query 5 — promedio examenes
            var conn5 = _context.Database.GetDbConnection();
            try
            {
                if (conn5.State != ConnectionState.Open) await conn5.OpenAsync();
                using var cmdProm = conn5.CreateCommand();
                cmdProm.CommandText = @"SELECT AVG(e.CalificacionFinal) FROM Examenes e 
                                        INNER JOIN Apuntes a ON e.ApunteID = a.ApunteID 
                                        WHERE a.EstudianteID = @uid AND e.CalificacionFinal IS NOT NULL";
                cmdProm.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                var prom = await cmdProm.ExecuteScalarAsync();
                vm.PromedioExamenes = prom != null && prom != DBNull.Value ? Math.Round((decimal)prom, 1) : null;
            }
            finally { await conn5.CloseAsync(); }

            return View(vm);
        }

        [HttpPost]
        public async Task<IActionResult> Actualizar([FromBody] ActualizarPerfilDto dto)
        {
            var userId = GetUserId();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "UPDATE Estudiantes SET NombreCompleto = @n WHERE EstudianteID = @uid";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@n", dto.NombreCompleto!));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }
            return Ok();
        }

        private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    public class PerfilVM
    {
        public string NombreCompleto { get; set; } = "";
        public string Correo { get; set; } = "";
        public int TotalApuntes { get; set; }
        public int TotalResumenes { get; set; }
        public int TotalExamenes { get; set; }
        public decimal? PromedioExamenes { get; set; }
    }

    public class ActualizarPerfilDto
    {
        public string? NombreCompleto { get; set; }
    }
}