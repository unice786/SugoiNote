using SugoiNote.Models;
using SugoiNote.Services.Common;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Services.Ia;
using SugoiNote.Services.Apuntes;

namespace SugoiNote.Services.Resumenes;

public interface IResumenService
{
    Task<IReadOnlyList<(Guid ApunteId, string Titulo, DateTime? Fecha, bool TieneResumen)>> ListarAsync(Guid estudianteId, CancellationToken ct = default);
    Task<IReadOnlyList<MateriaListItem>> ListarApuntesAsync(Guid estudianteId, CancellationToken ct = default);

    /// <summary>
    /// Genera el resumen. NUNCA persiste texto de error: si la IA falla se devuelve el error
    /// y no se escribe nada en la base de datos.
    /// </summary>
    Task<(bool Ok, string Html, string? Error)> GenerarAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default);

    Task<string?> ObtenerAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default);
}

public class ResumenService(Sugoinotee2Context db, IIaClient ia, IHtmlSanitizer sanitizer, ILogger<ResumenService> logger) : IResumenService
{
    public async Task<IReadOnlyList<(Guid, string, DateTime?, bool)>> ListarAsync(Guid estudianteId, CancellationToken ct = default)
    {
        var filas = await db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId)
            .OrderByDescending(a => a.FechaRegistro)
            .Select(a => new { a.ApunteId, a.TituloNota, a.FechaRegistro, TieneResumen = a.ResumenGeneradoIA != null && a.ResumenGeneradoIA != "" })
            .ToListAsync(ct);

        return filas.Select(x => (x.ApunteId, x.TituloNota, x.FechaRegistro, x.TieneResumen)).ToList();
    }

    public async Task<IReadOnlyList<MateriaListItem>> ListarApuntesAsync(Guid estudianteId, CancellationToken ct = default) =>
        await db.Apuntes.AsNoTracking()
            .Where(a => a.EstudianteId == estudianteId)
            .OrderByDescending(a => a.FechaRegistro)
            .Select(a => new MateriaListItem { MateriaId = a.ApunteId, NombreMateria = a.TituloNota })
            .ToListAsync(ct);

    public async Task<string?> ObtenerAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default) =>
        await db.Apuntes.AsNoTracking()
            .Where(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId)
            .Select(a => a.ResumenGeneradoIA)
            .FirstOrDefaultAsync(ct);

    public async Task<(bool Ok, string Html, string? Error)> GenerarAsync(Guid apunteId, Guid estudianteId, CancellationToken ct = default)
    {
        var apunte = await db.Apuntes
            .FirstOrDefaultAsync(a => a.ApunteId == apunteId && a.EstudianteId == estudianteId, ct);

        if (apunte is null) return (false, "", "El apunte no existe o no te pertenece.");

        var contenido = ExtraerTexto(apunte.ContenidoTexto ?? "");
        if (string.IsNullOrWhiteSpace(contenido))
            return (false, "", "El apunte está vacío. Escribe algo antes de generar el resumen.");

        var system = """
            Eres un asistente educativo que ayuda a estudiantes a revisar sus apuntes.
            Reglas:
            - Responde SOLO con HTML válido y simple: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <code>.
            - NO uses <script>, estilos inline, atributos style, ni <html>/<body>.
            - Basate EXCLUSIVAMENTE en el contenido proporcionado. Si algo no esta, no lo inventes.
            - En espanol, tono claro y conciso.
            - No incluyas el bloque ```html ni las comillas que delimitarian tu respuesta.
            """;

        var prompt = $"""
            Titulo del apunte: {apunte.TituloNota}

            Contenido:
            ---
            {contenido}
            ---

            Genera un resumen estructurado del apunte con:
            1. Los conceptos clave (lista).
            2. Una explicacion clara de cada bloque principal.
            3. Los datos o definiciones que hay que memorizar.
            4. Un breve resumen de cierre en 2 o 3 frases.
            """;

        string html;
        try
        {
            html = await ia.TextoAsync(system, prompt, ct);
        }
        catch (IaException ex)
        {
            // FIX C10: antes se devolvia $"<p>Error interno: {ex.Message}</p>" como si fuera el resumen
            // y ese texto se guardaba en la BD de forma permanente.
            logger.LogWarning(ex, "Fallo al generar el resumen del apunte {ApunteId}", apunteId);
            return (false, "", ex.Message);
        }

        html = LimpiarHtmlRespuesta(html);
        var sanitizado = sanitizer.Sanitize(html);

        if (string.IsNullOrWhiteSpace(sanitizado))
        {
            // Antes esto fallaba en silencio y era imposible saber si la IA no devolvió
            // nada o si fue el saneador quien lo dejó vacío.
            logger.LogWarning(
                "El resumen del apunte {ApunteId} quedó vacío tras el saneado. Texto de la IA ({Largo} chars): {Crudo}",
                apunteId, html.Length, html.Length <= 800 ? html : html[..800]);
            return (false, "", "La IA devolvió un resumen vacío.");
        }

        apunte.ResumenGeneradoIA = sanitizado;
        await db.SaveChangesAsync(ct);

        return (true, sanitizado, null);
    }

    /// <summary>Quita el venvoltorio ```html ... ``` que a veces añade el modelo.</summary>
    private static string LimpiarHtmlRespuesta(string html)
    {
        var t = html.Trim();
        if (!t.StartsWith("```", StringComparison.Ordinal)) return t;

        var primerSalto = t.IndexOf('\n');
        if (primerSalto > 0) t = t[(primerSalto + 1)..];

        var cierre = t.LastIndexOf("```", StringComparison.Ordinal);
        if (cierre > 0) t = t[..cierre];

        return t.Trim();
    }

    internal static string ExtraerTexto(string html, int max = 8000)
    {
        var limpio = System.Text.RegularExpressions.Regex.Replace(html, @"<(script|style)[^>]*>.*?</\1>", " ",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline,
            TimeSpan.FromSeconds(2));

        limpio = System.Text.RegularExpressions.Regex.Replace(limpio, "<[^>]+>", " ");
        limpio = System.Net.WebUtility.HtmlDecode(limpio);
        limpio = System.Text.RegularExpressions.Regex.Replace(limpio, @"\s+", " ").Trim();

        return limpio.Length > max ? limpio[..max] : limpio;
    }
}