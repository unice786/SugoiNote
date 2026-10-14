using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SugoiNote.Models;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Perfiles;

public class StatItem
{
    public string Etiqueta { get; set; } = string.Empty;
    public int Valor { get; set; }
}

public class PerfilDatos
{
    public Guid EstudianteId { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string CorreoElectronico { get; set; } = string.Empty;
    public string? FotoPerfil { get; set; }
    public DateTime? FechaCreacion { get; set; }

    public int TotalApuntes { get; set; }
    public int ApuntesEsteMes { get; set; }
    public int TotalMaterias { get; set; }
    public int TotalExamenes { get; set; }
    public double Promedio { get; set; }
    public int ExamenesAprobados { get; set; }
    public int DiasActivo { get; set; }
    public int DiasConApuntes { get; set; }
    public double TasaApuntesMes { get; set; }
    public List<StatItem> ApuntesPorMes { get; set; } = [];
    public List<StatItem> RendimientoPorMateria { get; set; } = [];
}

public interface IPerfilService
{
    Task<PerfilDatos?> ObtenerAsync(Guid estudianteId, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> ActualizarAsync(Guid estudianteId, string nombre, string correo, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> ActualizarFotoAsync(Guid estudianteId, string dataUri, CancellationToken ct = default);
}

public class PerfilService(
    Sugoinotee2Context db,
    IHtmlSanitizer sanitizer,
    IOptions<LimitesOptions> limites,
    ILogger<PerfilService> logger) : IPerfilService
{
    private readonly LimitesOptions _limites = limites.Value;

    public async Task<PerfilDatos?> ObtenerAsync(Guid estudianteId, CancellationToken ct = default)
    {
        var estudiante = await db.Estudiantes.AsNoTracking()
            .Where(e => e.EstudianteId == estudianteId)
            .Select(e => new
            {
                e.EstudianteId,
                e.NombreCompleto,
                e.CorreoElectronico,
                e.FotoPerfil,
                e.FechaCreacion,
                TotalApuntes = e.Apuntes.Count,
                TotalMaterias = e.Materias.Count,
                TotalExamenes = e.Apuntes.Sum(a => a.Examenes.Count),
                ExamenesAprobados = e.Apuntes.Sum(a => a.Examenes.Count(x => x.CalificacionFinal >= 60)),
                SumaNotas = e.Apuntes.SelectMany(a => a.Examenes)
                                     .Where(x => x.CalificacionFinal != null)
                                     .Sum(x => x.CalificacionFinal ?? 0),
                TotalCalificados = e.Apuntes.SelectMany(a => a.Examenes)
                                              .Count(x => x.CalificacionFinal != null),
            })
            .FirstOrDefaultAsync(ct);

        if (estudiante is null) return null;

        // Rango de fechas en UTC en vez de MONTH()/YEAR() sobre cada fila: las funciones de fecha
        // sobre columna impedian que el indice se usara y obligaban a un escaneo completo.
        var ahora = DateTime.UtcNow;
        var inicioMes = new DateTime(ahora.Year, ahora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var hace6Meses = inicioMes.AddMonths(-5);

        var apuntes = await db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId && a.FechaRegistro >= hace6Meses)
            .Select(a => new { a.FechaRegistro })
            .ToListAsync(ct);

        var apuntesEsteMes = await db.Apuntes.AsNoTracking()
            .CountAsync(a => a.EstudianteId == estudianteId && a.FechaRegistro >= inicioMes, ct);

        var fechasTodas = await db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId && a.FechaRegistro != null)
            .Select(a => a.FechaRegistro!.Value)
            .ToListAsync(ct);

        var diasDistintos = fechasTodas.Select(d => d.Date).Distinct().Count();

        var diasActivo = estudiante.FechaCreacion is null
            ? 1
            : Math.Max(1, (ahora - DateTime.SpecifyKind(estudiante.FechaCreacion.Value, DateTimeKind.Utc)).Days);

        var vm = new PerfilDatos
        {
            EstudianteId = estudiante.EstudianteId,
            NombreCompleto = estudiante.NombreCompleto,
            CorreoElectronico = estudiante.CorreoElectronico,
            FotoPerfil = sanitizer.SanitizeUrl(estudiante.FotoPerfil),
            FechaCreacion = estudiante.FechaCreacion,

            TotalApuntes = estudiante.TotalApuntes,
            ApuntesEsteMes = apuntesEsteMes,
            TotalMaterias = estudiante.TotalMaterias,
            TotalExamenes = estudiante.TotalExamenes,
            ExamenesAprobados = estudiante.ExamenesAprobados,
            Promedio = estudiante.TotalCalificados > 0
                ? Math.Round((double)(estudiante.SumaNotas / estudiante.TotalCalificados), 2)
                : 0,
            DiasActivo = diasActivo,
            DiasConApuntes = diasDistintos,
            TasaApuntesMes = diasActivo > 0 ? Math.Round(estudiante.TotalApuntes / (double)diasActivo * 30, 2) : 0,
        };

        // Serie de 6 meses, rellenando los meses sin apuntes con 0.
        var porMes = apuntes
            .Where(a => a.FechaRegistro.HasValue)
            .GroupBy(a => new DateTime(a.FechaRegistro!.Value.Year, a.FechaRegistro!.Value.Month, 1))
            .ToDictionary(g => g.Key, g => g.Count());

        for (var i = 5; i >= 0; i--)
        {
            var clave = inicioMes.AddMonths(-i);
            vm.ApuntesPorMes.Add(new StatItem
            {
                Etiqueta = clave.ToString("MMM", System.Globalization.CultureInfo.InvariantCulture),
                Valor = porMes.GetValueOrDefault(clave, 0),
            });
        }

        return vm;
    }

    public async Task<(bool Ok, string? Error)> ActualizarAsync(Guid estudianteId, string nombre, string correo, CancellationToken ct = default)
    {
        var n = (nombre ?? string.Empty).Trim();
        if (n.Length < 2) return (false, "El nombre debe tener al menos 2 caracteres.");
        if (n.Length > 150) return (false, "El nombre no puede superar los 150 caracteres.");

        var c = (correo ?? string.Empty).Trim().ToLowerInvariant();
        if (!EmailValido(c)) return (false, "El correo no tiene un formato válido.");

        var estudiante = await db.Estudiantes.FirstOrDefaultAsync(e => e.EstudianteId == estudianteId, ct);
        if (estudiante is null) return (false, "No se encontró tu cuenta.");

        var correoCambia = !string.Equals(estudiante.CorreoElectronico, c, StringComparison.OrdinalIgnoreCase);

        if (correoCambia)
        {
            var ocupado = await db.Estudiantes
                .AnyAsync(e => e.CorreoElectronico == c && e.EstudianteId != estudianteId, ct);
            if (ocupado) return (false, "Ese correo ya está registrado con otra cuenta.");
        }

        // El indice unico de la BD tambien protege contra la carrera entre dos peticiones
        // simultaneas; aqui solo evitamos el error 500 cuando detectamos el choque antes.
        estudiante.NombreCompleto = n;
        if (correoCambia)
        {
            estudiante.CorreoElectronico = c;
            estudiante.SecurityStamp = Guid.NewGuid().ToString("N");
        }

        try
        {
            await db.SaveChangesAsync(ct);
            return (true, null);
        }
        catch (DbUpdateException ex)
        {
            logger.LogWarning(ex, "Choque de correo unico al actualizar el perfil de {EstudianteId}", estudianteId);
            return (false, "Ese correo ya está registrado con otra cuenta.");
        }
    }

    public async Task<(bool Ok, string? Error)> ActualizarFotoAsync(Guid estudianteId, string dataUri, CancellationToken ct = default)
    {
        var v = (dataUri ?? string.Empty).Trim();

        if (v.Length == 0) return (false, "No se recibió ninguna imagen.");

        // El limite se comprueba sobre el string base64 porque es lo que realmente se guarda.
        if (v.Length > _limites.MaxBytesImagen * 4L / 3L + 1024)
            return (false, $"La imagen no puede superar {Math.Round(_limites.MaxBytesImagen / 1024.0 / 1024, 1)} MB.");

        if (!sanitizer.EsUrlSegura(v))
            return (false, "Formato de imagen no válido. Usa PNG, JPG, GIF o WEBP.");

        var estudiante = await db.Estudiantes.FirstOrDefaultAsync(e => e.EstudianteId == estudianteId, ct);
        if (estudiante is null) return (false, "No se encontró tu cuenta.");

        estudiante.FotoPerfil = v;
        await db.SaveChangesAsync(ct);
        return (true, null);
    }

    private static bool EmailValido(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 150) return false;

        var arroba = email.IndexOf('@');
        if (arroba <= 0 || arroba != email.LastIndexOf('@') || arroba == email.Length - 1) return false;

        var dominio = email[(arroba + 1)..];
        var punto = dominio.IndexOf('.');

        // Debe haber dominio con al menos un punto, sin espacios ni puntos en los extremos.
        return punto > 0 && punto < dominio.Length - 1
               && !email.Any(char.IsWhiteSpace)
               && !dominio.StartsWith('.') && !dominio.EndsWith('.');
    }
}