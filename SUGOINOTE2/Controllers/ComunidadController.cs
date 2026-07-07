using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using System.Data;
using System.Security.Claims;

namespace SugoiNote.Controllers
{
    [Authorize]
    public class ComunidadController : Controller
    {
        private readonly Sugoinotee2Context _context;

        public ComunidadController(Sugoinotee2Context context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            var posts = new List<PostVM>();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT f.PostID, e.NombreCompleto, f.TituloPregunta, f.DetallePregunta, 
                           f.FechaPublicacion, f.EstudianteID,
                           (SELECT COUNT(*) FROM RespuestasForo r WHERE r.PostID = f.PostID) as TotalRespuestas
                    FROM ForoComunidad f
                    INNER JOIN Estudiantes e ON f.EstudianteID = e.EstudianteID
                    ORDER BY f.FechaPublicacion DESC";
                using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                    posts.Add(new PostVM
                    {
                        PostId = r.GetGuid(0),
                        NombreEstudiante = r.GetString(1),
                        Titulo = r.GetString(2),
                        Detalle = r.GetString(3),
                        Fecha = r.IsDBNull(4) ? null : r.GetDateTime(4),
                        EstudianteId = r.GetGuid(5),
                        TotalRespuestas = r.GetInt32(6)
                    });
            }
            finally { await conn.CloseAsync(); }
            return View(posts);
        }

        [HttpGet]
        public async Task<IActionResult> Ver(Guid id)
        {
            var userId = GetUserId();
            PostDetalleVM? vm = null;
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmdP = conn.CreateCommand();
                cmdP.CommandText = @"SELECT f.PostID, e.NombreCompleto, f.TituloPregunta, 
                                     f.DetallePregunta, f.FechaPublicacion, f.EstudianteID
                                     FROM ForoComunidad f
                                     INNER JOIN Estudiantes e ON f.EstudianteID = e.EstudianteID
                                     WHERE f.PostID = @id";
                cmdP.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", id));
                using var rP = await cmdP.ExecuteReaderAsync();
                if (await rP.ReadAsync())
                    vm = new PostDetalleVM
                    {
                        PostId = rP.GetGuid(0),
                        NombreEstudiante = rP.GetString(1),
                        Titulo = rP.GetString(2),
                        Detalle = rP.GetString(3),
                        Fecha = rP.IsDBNull(4) ? null : rP.GetDateTime(4),
                        EstudianteId = rP.GetGuid(5)
                    };
            }
            finally { await conn.CloseAsync(); }

            if (vm == null) return NotFound();

            var conn2 = _context.Database.GetDbConnection();
            try
            {
                if (conn2.State != ConnectionState.Open) await conn2.OpenAsync();
                using var cmdR = conn2.CreateCommand();
                cmdR.CommandText = @"SELECT r.RespuestaID, e.NombreCompleto, r.TextoRespuesta, 
                                     r.FechaRespuesta, r.EstudianteID
                                     FROM RespuestasForo r
                                     INNER JOIN Estudiantes e ON r.EstudianteID = e.EstudianteID
                                     WHERE r.PostID = @id ORDER BY r.FechaRespuesta ASC";
                cmdR.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", id));
                using var rR = await cmdR.ExecuteReaderAsync();
                while (await rR.ReadAsync())
                    vm.Respuestas.Add(new RespuestaVM
                    {
                        RespuestaId = rR.GetGuid(0),
                        NombreEstudiante = rR.GetString(1),
                        Texto = rR.GetString(2),
                        Fecha = rR.IsDBNull(3) ? null : rR.GetDateTime(3),
                        EstudianteId = rR.GetGuid(4)
                    });
            }
            finally { await conn2.CloseAsync(); }

            ViewBag.UserId = userId;
            return View(vm);
        }

        [HttpPost]
        public async Task<IActionResult> CrearPost([FromBody] CrearPostDto dto)
        {
            var userId = GetUserId();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"INSERT INTO ForoComunidad (PostID, EstudianteID, TituloPregunta, DetallePregunta, FechaPublicacion)
                                    VALUES (@id, @uid, @t, @d, @f)";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.NewGuid()));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", dto.Titulo!));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@d", dto.Detalle!));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@f", DateTime.Now));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }
            return Ok();
        }

        [HttpPost]
        public async Task<IActionResult> Responder([FromBody] ResponderDto dto)
        {
            var userId = GetUserId();
            var conn = _context.Database.GetDbConnection();
            try
            {
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"INSERT INTO RespuestasForo (RespuestaID, PostID, EstudianteID, TextoRespuesta, FechaRespuesta)
                                    VALUES (@id, @pid, @uid, @t, @f)";
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@id", Guid.NewGuid()));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@pid", Guid.Parse(dto.PostId!)));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@uid", userId));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@t", dto.Texto!));
                cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@f", DateTime.Now));
                await cmd.ExecuteNonQueryAsync();
            }
            finally { await conn.CloseAsync(); }
            return Ok();
        }

        private Guid GetUserId() => Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
    }

    public class PostVM
    {
        public Guid PostId { get; set; }
        public string NombreEstudiante { get; set; } = "";
        public string Titulo { get; set; } = "";
        public string Detalle { get; set; } = "";
        public DateTime? Fecha { get; set; }
        public Guid EstudianteId { get; set; }
        public int TotalRespuestas { get; set; }
    }

    public class PostDetalleVM
    {
        public Guid PostId { get; set; }
        public string NombreEstudiante { get; set; } = "";
        public string Titulo { get; set; } = "";
        public string Detalle { get; set; } = "";
        public DateTime? Fecha { get; set; }
        public Guid EstudianteId { get; set; }
        public List<RespuestaVM> Respuestas { get; set; } = new();
    }

    public class RespuestaVM
    {
        public Guid RespuestaId { get; set; }
        public string NombreEstudiante { get; set; } = "";
        public string Texto { get; set; } = "";
        public DateTime? Fecha { get; set; }
        public Guid EstudianteId { get; set; }
    }

    public class CrearPostDto
    {
        public string? Titulo { get; set; }
        public string? Detalle { get; set; }
    }

    public class ResponderDto
    {
        public string? PostId { get; set; }
        public string? Texto { get; set; }
    }
}