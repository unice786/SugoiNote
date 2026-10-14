using Microsoft.AspNetCore.Html;

namespace SugoiNote.Services.Common;

/// <summary>
/// Marca el enlace de menú que corresponde a la página actual.
/// </summary>
/// <remarks>
/// Existe como método aparte, y no como expresión Razor dentro del atributo, por un motivo
/// concreto: <c>aria-current="@(ctrl == "Home" ? "page" : null)"</c> no compila bien porque
/// Razor desbalancea las comillas del interior del valor del atributo y termina escribiendo
/// <c>aria-current="page</c> sin comilla de cierre. Llamarlo como <c>@Menu.Current(ctrl, "Home")</c>
/// fuera del valor de cualquier atributo evita por completo esa ambigüedad.
/// </remarks>
public static class Menu
{
    /// <summary>
    /// Devuelve <c> aria-current="page"</c> si <paramref name="actual"/> coincide con
    /// <paramref name="controller"/>, y una cadena vacía en caso contrario (para que el
    /// atributo no aparezca en los enlaces inactivos).
    /// </summary>
    public static IHtmlContent Current(string? actual, string controller) =>
        actual == controller
            ? new HtmlString(" aria-current=\"page\"")
            : HtmlString.Empty;
}