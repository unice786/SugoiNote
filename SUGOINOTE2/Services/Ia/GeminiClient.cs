using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Ia;

/// <summary>Error de negocio de la capa de IA. El mensaje es apto para mostrar al usuario final.</summary>
public class IaException(string mensaje, bool reintentable = false) : Exception(mensaje)
{
    public bool Reintentable { get; } = reintentable;
}

public interface IIaClient
{
    /// <summary>Llamada de texto simple. Lanza <see cref="IaException"/> con mensaje apto para el usuario.</summary>
    Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);

    /// <summary>Llamada que debe devolver JSON parseable. Lanza si la respuesta no es JSON válido.</summary>
    Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);

    /// <summary>Llamada con imagen adjunta (data-URI).</summary>
    Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default);
}

/// <summary>
/// Cliente único de la API de Google Gemini (Google AI Studio).
/// Sustituye a la antigua capa de Anthropic: la cuenta de Anthropic no tenía saldo
/// y dejaba sin IA a los resúmenes, exámenes y al chat. La interfaz es la misma
/// (<see cref="IIaClient"/>) para que los servicios no cambien.
/// </summary>
public sealed class GeminiClient(
    HttpClient http,
    IOptions<IaOptions> options,
    ILogger<GeminiClient> logger) : IIaClient
{
    private readonly IaOptions _opt = options.Value;

    public async Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        var nodo = await EnviarAsync(
            rapido ? _opt.ModelFast : _opt.Model,
            system,
            new JsonArray(new JsonObject { ["text"] = prompt }),
            json: false,
            ct);

        return LeerTexto(nodo);
    }

    public async Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        var systemJson = system + "\n\nIMPORTANTE: responde EXCLUSIVAMENTE con JSON válido. Sin texto antes ni después, sin bloques de código markdown.";

        var nodo = await EnviarAsync(
            rapido ? _opt.ModelFast : _opt.Model,
            systemJson,
            new JsonArray(new JsonObject { ["text"] = prompt }),
            json: true,
            ct);

        var texto = LeerTexto(nodo);

        var limpio = ExtraerJson(texto);
        try
        {
            return JsonNode.Parse(limpio)
                   ?? throw new IaException("La IA devolvió una respuesta vacía.");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "JSON inválido devuelto por la IA. Primeros 300 chars: {Raw}", texto[..Math.Min(300, texto.Length)]);
            throw new IaException("La IA no devolvió una respuesta en el formato esperado. Inténtalo de nuevo.");
        }
    }

    public async Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default)
    {
        var (mediaType, base64) = SepararDataUri(dataUri);

        var partes = new JsonArray(
            new JsonObject
            {
                ["inlineData"] = new JsonObject
                {
                    ["mimeType"] = mediaType,
                    ["data"] = base64,
                },
            },
            new JsonObject { ["text"] = prompt });

        var nodo = await EnviarAsync(_opt.Model, system, partes, json: false, ct);

        return LeerTexto(nodo);
    }

    // ── Transporte ─────────────────────────────────────────────

    private async Task<JsonNode> EnviarAsync(string modelo, string system, JsonArray partes, bool json, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_opt.ApiKey))
        {
            logger.LogError("IA:ApiKey no está configurada.");
            throw new IaException("La inteligencia artificial no está configurada en este servidor.");
        }

        var configuracion = new JsonObject { ["maxOutputTokens"] = _opt.MaxTokens };
        if (json) configuracion["responseMimeType"] = "application/json";

        var payload = new JsonObject
        {
            ["systemInstruction"] = new JsonObject
            {
                ["parts"] = new JsonArray(new JsonObject { ["text"] = system }),
            },
            ["contents"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = partes,
            }),
            ["generationConfig"] = configuracion,
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"v1beta/models/{modelo}:generateContent");
        request.Headers.TryAddWithoutValidation("x-goog-api-key", _opt.ApiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        HttpResponseMessage respuesta;
        try
        {
            // La resiliencia (retry/circuit breaker) la aplica el HttpClient de Polly en Program.cs.
            respuesta = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogError("Timeout hablando con la API de Gemini tras {Timeout}.", _opt.Timeout);
            throw new IaException("La IA tardó demasiado en responder. Inténtalo de nuevo.", reintentable: true);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Fallo de red al llamar a la API de Gemini.");
            throw new IaException("No se pudo contactar con el servicio de IA. Revisa tu conexión.", reintentable: true);
        }

        using (respuesta)
        {
            var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);

            if (!respuesta.IsSuccessStatusCode)
            {
                logger.LogError("Gemini respondio {Status}: {Body}", (int)respuesta.StatusCode, Recortar(cuerpo, 800));
                throw TraducirError(respuesta.StatusCode, cuerpo);
            }

            try
            {
                return JsonNode.Parse(cuerpo)!;
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Respuesta 200 de Gemini con cuerpo no-JSON: {Body}", Recortar(cuerpo, 500));
                throw new IaException("El servicio de IA devolvió una respuesta inesperada.");
            }
        }
    }

    private static IaException TraducirError(System.Net.HttpStatusCode status, string cuerpo)
    {
        var mensajeApi = JsonNode.Parse(cuerpo)?["error"]?["message"]?.GetValue<string>() ?? string.Empty;

        if (mensajeApi.Contains("no longer available", StringComparison.OrdinalIgnoreCase))
            return new IaException("El modelo de IA configurado ya no está disponible. Revisa la configuración del servidor.");

        return status switch
        {
            System.Net.HttpStatusCode.TooManyRequests =>
                new IaException("Se alcanzó el límite de peticiones gratuitas de la IA. Espera un momento e inténtalo de nuevo.", reintentable: true),

            System.Net.HttpStatusCode.ServiceUnavailable or System.Net.HttpStatusCode.BadGateway =>
                new IaException("El servicio de IA está temporalmente saturado. Inténtalo en unos minutos.", reintentable: true),

            (System.Net.HttpStatusCode)401 or (System.Net.HttpStatusCode)403 =>
                new IaException("La clave de la IA es inválida o no tiene permisos. Revisa la configuración del servidor."),

            // Gemini responde 400 (INVALID_ARGUMENT) tanto por una clave inválida como por una petición mal formada.
            System.Net.HttpStatusCode.BadRequest when mensajeApi.Contains("API key", StringComparison.OrdinalIgnoreCase) =>
                new IaException("La clave de la IA es inválida o no tiene permisos. Revisa la configuración del servidor."),

            System.Net.HttpStatusCode.NotFound =>
                new IaException("El modelo de IA configurado no existe. Revisa la configuración del servidor."),

            _ => new IaException("No se pudo completar la solicitud a la IA."),
        };
    }

    /// <summary>
    /// Une todos los bloques de texto de la respuesta. Los modelos con razonamiento
    /// devuelven además bloques marcados con <c>thought: true</c>, que son su borrador
    /// interno y NO deben mostrarse ni parsearse como resultado.
    /// </summary>
    private static string LeerTexto(JsonNode nodo)
    {
        var candidato = (nodo["candidates"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault();

        if (candidato is null)
        {
            var bloqueado = nodo["promptFeedback"]?["blockReason"]?.GetValue<string>();
            if (!string.IsNullOrWhiteSpace(bloqueado))
                throw new IaException("La IA rechazó la solicitud por sus filtros de contenido. Cambia el texto e inténtalo de nuevo.");

            throw new IaException("La IA devolvió una respuesta vacía.");
        }

        var texto = string.Concat(
            (candidato["content"]?["parts"] as JsonArray)?
                .OfType<JsonObject>()
                .Where(p => p["thought"]?.GetValue<bool>() != true)
                .Select(p => p["text"]?.GetValue<string>())
                .Where(t => !string.IsNullOrEmpty(t))
            ?? []);

        if (!string.IsNullOrWhiteSpace(texto)) return texto;

        // Sin texto: puede ser un corte por filtros de seguridad o por longitud.
        return candidato["finishReason"]?.GetValue<string>() switch
        {
            "SAFETY" or "PROHIBITED_CONTENT" or "BLOCKLIST" =>
                throw new IaException("La IA rechazó la solicitud por sus filtros de contenido. Cambia el texto e inténtalo de nuevo."),

            "MAX_TOKENS" =>
                throw new IaException("La IA se quedó sin espacio en la respuesta. Prueba con un texto más corto."),

            _ => throw new IaException("La IA devolvió una respuesta vacía."),
        };
    }

    /// <summary>
    /// Quita ```json ... ``` si el modelo lo añadió, y recorta al primer objeto/array balanceado.
    /// Antes esto fallaba en silencio y producía exámenes a medias.
    /// </summary>
    internal static string ExtraerJson(string texto)
    {
        var t = texto.Trim();

        if (t.StartsWith("```", StringComparison.Ordinal))
        {
            var primeraSalto = t.IndexOf('\n');
            if (primeraSalto > 0) t = t[(primeraSalto + 1)..];
            var finBloque = t.LastIndexOf("```", StringComparison.Ordinal);
            if (finBloque > 0) t = t[..finBloque];
            t = t.Trim();
        }

        var inicio = t.IndexOfAny(['{', '[']);
        if (inicio < 0) return t;

        var fin = t[^1] == '}' || t[^1] == ']'
            ? t.Length - 1
            : UltimoIndiceBalanceado(t, inicio);

        return fin > inicio ? t[inicio..(fin + 1)] : t[inicio..];
    }

    /// <summary>Recorre el texto ignorando comillas y escapes para hallar el cierre balanceado real.</summary>
    private static int UltimoIndiceBalanceado(string texto, int inicio)
    {
        var abre = texto[inicio];
        var cierra = abre == '{' ? '}' : ']';

        var profundidad = 0;
        var enComilla = false;
        var enComillaSimple = false;
        var escape = false;

        for (var i = inicio; i < texto.Length; i++)
        {
            var c = texto[i];

            if (escape) { escape = false; continue; }

            if (c == '\\' && enComilla) { escape = true; continue; }

            if (c == '"' && !enComillaSimple) { enComilla = !enComilla; continue; }
            if (c == '\'' && !enComilla) { enComillaSimple = !enComillaSimple; continue; }

            if (enComilla || enComillaSimple) continue;

            if (c == abre) profundidad++;
            else if (c == cierra)
            {
                profundidad--;
                if (profundidad == 0) return i;
            }
        }

        return -1;
    }

    private static (string MediaType, string Base64) SepararDataUri(string dataUri)
    {
        var coma = dataUri.IndexOf(',');
        if (coma < 0) throw new IaException("La imagen adjunta tiene un formato no válido.");

        var cabecera = dataUri[..coma];              // data:image/png;base64
        var cuerpo = dataUri[(coma + 1)..];

        var tipo = cabecera.Split(';')[0].Split(':').LastOrDefault();
        if (string.IsNullOrWhiteSpace(tipo) || !tipo.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new IaException("Solo se pueden adjuntar imágenes a la IA.");

        return (tipo, cuerpo);
    }

    private static string Recortar(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
