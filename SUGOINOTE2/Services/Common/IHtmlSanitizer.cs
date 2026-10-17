using System.Text.RegularExpressions;
using Ganss.Xss;

namespace SugoiNote.Services.Common;

public interface IHtmlSanitizer
{
    /// <summary>
    /// Limpia HTML de contenido de usuario. Conserva el marcado del editor (formato, listas,
    /// tablas, imágenes, bloques de código) y elimina &lt;script&gt;, onerror=, javascript:, etc.
    /// </summary>
    string Sanitize(string? html);

    /// <summary>
    /// Valida una URL antes de persistirla o emitirla en un atributo src/href.
    /// Acepta solo data-URI de imagen y http(s). Rechaza javascript:, data:text/html, vbscript:.
    /// </summary>
    bool EsUrlSegura(string? url);

    /// <summary>Devuelve la URL si es segura, o null si no lo es.</summary>
    string? SanitizeUrl(string? url);
}

// partial es obligatorio: el generador de código de [GeneratedRegex] emite
// otra declaración parcial de esta misma clase.
public sealed partial class SugoiHtmlSanitizer : IHtmlSanitizer
{
    private readonly Ganss.Xss.HtmlSanitizer _inner;

    public SugoiHtmlSanitizer()
    {
        // OJO: en HtmlSanitizer v9 las colecciones de HtmlSanitizerOptions arrancan VACIAS,
        // NO traen los valores por defecto de la librería. Con las listas vacías el saneador
        // elimina todas las etiquetas y, además, su contenido: los resúmenes de la IA
        // (<h2>, <p>, <ul>, <strong>...) quedaban en blanco. Por eso se parte de
        // HtmlSanitizerDefaults y luego se añade lo propio del editor de bloques.
        var opciones = new Ganss.Xss.HtmlSanitizerOptions
        {
            AllowedTags = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.AllowedTags, StringComparer.OrdinalIgnoreCase),
            AllowedAttributes = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.AllowedAttributes, StringComparer.OrdinalIgnoreCase),
            AllowedSchemes = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.AllowedSchemes, StringComparer.OrdinalIgnoreCase),
            AllowedCssProperties = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.AllowedCssProperties, StringComparer.OrdinalIgnoreCase),
            UriAttributes = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.UriAttributes, StringComparer.OrdinalIgnoreCase),
            UriListAttributes = new HashSet<string>(Ganss.Xss.HtmlSanitizerDefaults.UriListAttributes, StringComparer.OrdinalIgnoreCase),

            // AllowedCssClasses se deja vacío a propósito: un conjunto vacío significa
            // "todas las clases permitidas", y el editor usa clases propias (editor-table...).

            // El editor de bloques marca sus bloques con atributos data-*.
            AllowDataAttributes = true,
        };

        // Las colecciones son ISet<string>: se ExtENDER (no reemplazar) la lista por defecto
        // con los elementos que genera block-editor.js.
        opciones.AllowedTags.UnionWith(new[]
        {
            "div", "span", "section", "figure", "figcaption", "label", "input",
            "mark", "small", "s", "u", "sub", "sup",
            "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
            "pre", "code", "blockquote",
        });

        opciones.AllowedAttributes.UnionWith(new[]
        {
            "colspan", "rowspan", "width", "height", "align", "style", "class", "id",
            "data-lista-tipo", "data-bloque-id", "data-lang", "data-align", "data-cols",
            "data-id", "data-tipo",
        });

        // Necesario para las imágenes embebidas del editor (data:image/png;base64,...).
        opciones.AllowedSchemes.Add("data");

        opciones.AllowedCssProperties.UnionWith(new[]
        {
            "text-align", "font-weight", "font-style", "text-decoration",
            "background-color", "color", "width", "height", "max-width",
        });

        // Ninguna nota debe poder abrir una pestaña nueva que controle al sitio.
        // target queda permitido pero siempre con rel=noopener en AllowedRelHost...
        opciones.AllowedTags.Remove("script");
        opciones.AllowedTags.Remove("style");
        opciones.AllowedTags.Remove("iframe");
        opciones.AllowedTags.Remove("object");
        opciones.AllowedTags.Remove("embed");
        opciones.AllowedTags.Remove("form");
        opciones.AllowedTags.Remove("link");
        opciones.AllowedTags.Remove("meta");
        opciones.AllowedTags.Remove("base");

        _inner = new Ganss.Xss.HtmlSanitizer(opciones);

        // Los enlaces del contenido se abren en la misma pestaña.
        _inner.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Dom.IElement el && el.LocalName == "a" && el.HasAttribute("target"))
            {
                el.RemoveAttribute("target");
            }
        };
    }

    public string Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;

        try
        {
            return _inner.Sanitize(html);
        }
        catch
        {
            // Un HTML tan malformado que rompe el parser no debe tumbar la petición:
            // se cae a texto plano escapado.
            return System.Net.WebUtility.HtmlEncode(
                System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " "));
        }
    }

    [GeneratedRegex(@"^\s*data:image/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DataUriImagen();

    public bool EsUrlSegura(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        var v = url.Trim();

        // SVG se excluye a propósito: puede llevar <script> dentro del data-URI.
        if (DataUriImagen().IsMatch(v)) return true;

        if (!Uri.TryCreate(v, UriKind.Absolute, out var uri)) return false;

        // Solo esquemas con origen de red conocido. Bloquea javascript:, data:, vbscript:, file:.
        return uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps;
    }

    public string? SanitizeUrl(string? url) => EsUrlSegura(url) ? url!.Trim() : null;
}