using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Apuntes;

public class ApunteListItem
{
    public Guid ApunteId { get; set; }
    public string TituloNota { get; set; } = string.Empty;
    public Guid? MateriaId { get; set; }
    public string? NombreMateria { get; set; }
    public DateTime? FechaRegistro { get; set; }
    public bool TieneResumen { get; set; }
    public int CantidadImagenes { get; set; }

    /// <summary>Exámenes generados a partir de este apunte. Lo usa la app móvil.</summary>
    public int TotalExamenes { get; set; }
}

public class MateriaListItem
{
    public Guid MateriaId { get; set; }
    public string NombreMateria { get; set; } = string.Empty;
}

public class ResultadoOperacion(bool ok, string? error = null)
{
    public bool Ok { get; } = ok;
    public string? Error { get; } = error;

    public static ResultadoOperacion Exito() => new(true);
    public static ResultadoOperacion Fallo(string error) => new(false, error);
}

public interface IApunteService
{
    Task<IReadOnlyList<ApunteListItem>> ListarAsync(Guid estudianteId, CancellationToken ct = default);
    Task<IReadOnlyList<MateriaListItem>> ListarMateriasAsync(Guid estudianteId, CancellationToken ct = default);
    Task<IReadOnlyList<ApunteListItem>> ListarRecientesAsync(Guid estudianteId, int take, CancellationToken ct = default);

    Task<Apunte?> ObtenerAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default);

    /// <summary>Crea la materia al vuelo si se mandó un nombre nuevo. Deduplica por nombre (case-insensitive).</summary>
    Task<Guid?> ResolverMateriaAsync(Guid estudianteId, Guid? materiaId, string? nuevaMateria, CancellationToken ct = default);

    Task<ResultadoOperacion> CrearAsync(Apunte apunte, CancellationToken ct = default);
    Task<ResultadoOperacion> CrearRapidoAsync(Apunte apunte, CancellationToken ct = default);
    Task<ResultadoOperacion> AutoSaveAsync(Guid apunteId, Guid estudianteId, string titulo, string? contenido, CancellationToken ct = default);
    Task<ResultadoOperacion> GuardarResumenAsync(Guid apunteId, Guid estudianteId, string resumenHtml, CancellationToken ct = default);
    Task<ResultadoOperacion> EliminarAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default);
}

public class ApunteService(Sugoinotee2Context db, IHtmlSanitizer sanitizer, ILogger<ApunteService> logger) : IApunteService
{
    public async Task<IReadOnlyList<ApunteListItem>> ListarAsync(Guid estudianteId, CancellationToken ct = default) =>
        await ConsultarBase(estudianteId).OrderByDescending(a => a.FechaRegistro).ToListAsync(ct);

    public async Task<IReadOnlyList<MateriaListItem>> ListarMateriasAsync(Guid estudianteId, CancellationToken ct = default) =>
        await db.Materias.AsNoTracking()
            .Where(m => m.EstudianteId == estudianteId)
            .OrderBy(m => m.NombreMateria)
            .Select(m => new MateriaListItem { MateriaId = m.MateriaId, NombreMateria = m.NombreMateria })
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ApunteListItem>> ListarRecientesAsync(Guid estudianteId, int take, CancellationToken ct = default) =>
        await ConsultarBase(estudianteId).OrderByDescending(a => a.FechaRegistro).Take(take).ToListAsync(ct);

    private IQueryable<ApunteListItem> ConsultarBase(Guid estudianteId) =>
        db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId)
            .Select(a => new ApunteListItem
            {
                ApunteId = a.ApunteId,
                TituloNota = a.TituloNota,
                MateriaId = a.MateriaId,
                NombreMateria = a.Materia != null ? a.Materia.NombreMateria : null,
                FechaRegistro = a.FechaRegistro,
                TieneResumen = a.ResumenGeneradoIA != null && a.ResumenGeneradoIA != "",
                CantidadImagenes = 0,   // se calcula aparte si se necesita; evita traer ContenidoTexto
                TotalExamenes = db.Examenes.Count(e => e.ApunteId == a.ApunteId),
            });

    public async Task<Apunte?> ObtenerAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default) =>
        await db.Apuntes.AsNoTracking()
            .Where(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId)
            .FirstOrDefaultAsync(ct);

    public async Task<Guid?> ResolverMateriaAsync(Guid estudianteId, Guid? materiaId, string? nuevaMateria, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(nuevaMateria))
        {
            var nombre = nuevaMateria.Trim();

            if (nombre.Length > 100) nombre = nombre[..100];

            var existente = await db.Materias
                .FirstOrDefaultAsync(m => m.EstudianteId == estudianteId && m.NombreMateria == nombre, ct);

            if (existente is not null) return existente.MateriaId;

            var nueva = new Materia
            {
                MateriaId = Guid.NewGuid(),
                NombreMateria = nombre,
                EstudianteId = estudianteId,
            };
            db.Materias.Add(nueva);
            await db.SaveChangesAsync(ct);
            return nueva.MateriaId;
        }

        // Sin nombre nuevo: validar que la materia exista y sea del estudiante (evitacolgar apuntes ajenos).
        if (materiaId is null) return null;

        return await db.Materias.AnyAsync(m => m.MateriaId == materiaId && m.EstudianteId == estudianteId, ct)
            ? materiaId
            : null;
    }

    public async Task<ResultadoOperacion> CrearAsync(Apunte apunte, CancellationToken ct = default)
    {
        var titulo = (apunte.TituloNota ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(titulo))
            return ResultadoOperacion.Fallo("El título es obligatorio.");

        if (titulo.Length > 200) titulo = titulo[..200];

        apunte.ApunteId = Guid.NewGuid();
        apunte.TituloNota = titulo;
        apunte.ContenidoTexto = sanitizer.Sanitize(apunte.ContenidoTexto);
        apunte.EstudianteId = apunte.EstudianteId;
        apunte.FechaRegistro = DateTime.UtcNow;

        db.Apuntes.Add(apunte);
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion.Exito();
    }

    public async Task<ResultadoOperacion> CrearRapidoAsync(Apunte apunte, CancellationToken ct = default)
    {
        var titulo = (apunte.TituloNota ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(titulo))
            return ResultadoOperacion.Fallo("El título es obligatorio.");

        apunte.ApunteId = Guid.NewGuid();
        apunte.TituloNota = titulo.Length > 200 ? titulo[..200] : titulo;

        // Faltaba sanear aquí: el alta rápida (la que usa la API movil) guardaba el HTML
        // tal cual, lo que permitia inyectar <script>/onerror desde el cliente. Se alinea
        // con CrearAsync y AutoSaveAsync.
        apunte.ContenidoTexto = sanitizer.Sanitize(apunte.ContenidoTexto);
        apunte.FechaRegistro = DateTime.UtcNow;

        db.Apuntes.Add(apunte);
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion.Exito();
    }

    public async Task<ResultadoOperacion> AutoSaveAsync(Guid apunteId, Guid estudianteId, string titulo, string? contenido, CancellationToken ct = default)
    {
        var apunte = await db.Apuntes
            .FirstOrDefaultAsync(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId, ct);

        if (apunte is null) return ResultadoOperacion.Fallo("El apunte no existe o no te pertenece.");

        var limpio = titulo.Trim();
        apunte.TituloNota = string.IsNullOrWhiteSpace(limpio) ? "Sin título" : (limpio.Length > 200 ? limpio[..200] : limpio);
        apunte.ContenidoTexto = sanitizer.Sanitize(contenido);

        await db.SaveChangesAsync(ct);
        return ResultadoOperacion.Exito();
    }

    public async Task<ResultadoOperacion> GuardarResumenAsync(Guid apunteId, Guid estudianteId, string resumenHtml, CancellationToken ct = default)
    {
        var apunte = await db.Apuntes
            .FirstOrDefaultAsync(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId, ct);

        if (apunte is null) return ResultadoOperacion.Fallo("El apunte no existe o no te pertenece.");

        apunte.ResumenGeneradoIA = sanitizer.Sanitize(resumenHtml);
        await db.SaveChangesAsync(ct);
        return ResultadoOperacion.Exito();
    }

    /// <summary>
    /// Borra el apunte y, por cascada, sus exámenes, preguntas, opciones y respuestas de foro
    /// asociadas a sus posts. Ya no hace falta la cadena manual de 4 DELETE sin filtro de
    /// propietario que existía antes (y que permitia borrar apuntes ajenos).
    /// </summary>
    public async Task<ResultadoOperacion> EliminarAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default)
    {
        var apunte = await db.Apuntes
            .FirstOrDefaultAsync(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId, ct);

        if (apunte is null) return ResultadoOperacion.Fallo("El apunte no existe o no te pertenece.");

        try
        {
            db.Apuntes.Remove(apunte);
            await db.SaveChangesAsync(ct);
            return ResultadoOperacion.Exito();
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Fallo al eliminar el apunte {ApunteId}", apunteId);
            return ResultadoOperacion.Fallo("No se pudo eliminar el apunte porque tiene datos relacionados.");
        }
    }
}