using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Anthropic;

/// <summary>Error de negocio de la capa de IA. El mensaje es apto para mostrar al usuario final.</summary>
public class AnthropicException(string mensaje, bool reintentable = false) : Exception(mensaje)
{
    public bool Reintentable { get; } = reintentable;
}

public interface IAnthropicClient
{
    /// <summary>Llamada de texto simple. Lanza <see cref="AnthropicException"/> con mensaje apto para el usuario.</summary>
    Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);

    /// <summary>Llamada que debe devolver JSON.parseable. Lanza si la respuesta no es JSON válido.</summary>
    Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);

    /// <summary>Llamada con imagen adjunta (data-URI).</summary>
    Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default);
}

/// <summary>
/// Cliente único de Anthropic. Sustituye las 4 copias de <c>new HttpClient()</c> +
/// <c>JsonDocument.Parse(...).GetProperty("content")[0]</c> que había en los controladores.
/// </summary>
public sealed class AnthropicClient(
    HttpClient http,
    IOptions<AnthropicOptions> options,
    ILogger<AnthropicClient> logger) : IAnthropicClient
{
    private const string BaseAddress = "https://api.anthropic.com/";
    private const string Version = "2023-06-01";

    private readonly AnthropicOptions _opt = options.Value;

    public async Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        var nodo = await EnviarAsync(new JsonObject
        {
            ["model"] = rapido ? _opt.ModelFast : _opt.Model,
            ["max_tokens"] = _opt.MaxTokens,
            ["system"] = system,
            ["messages"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["content"] = prompt,
            }),
        }, ct);

        return LeerPrimerBloqueDeTexto(nodo);
    }

    public async Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        var systemJson = system + "\n\nIMPORTANTE: responde EXCLUSIVAMENTE con JSON válido. Sin texto antes ni después, sin bloques de código markdown.";

        var texto = await TextoAsync(systemJson, prompt, ct, rapido);

        var limpio = ExtraerJson(texto);
        try
        {
            return JsonNode.Parse(limpio)
                   ?? throw new AnthropicException("La IA devolvió una respuesta vacía.");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "JSON inválido devuelto por la IA. Primeros 300 chars: {Raw}", texto[..Math.Min(300, texto.Length)]);
            throw new AnthropicException("La IA no devolvió una respuesta en el formato esperado. Inténtalo de nuevo.");
        }
    }

    public async Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default)
    {
        var (mediaType, base64) = SepararDataUri(dataUri);

        var contenido = new JsonArray(
            new JsonObject
            {
                ["type"] = "image",
                ["source"] = new JsonObject
                {
                    ["type"] = "base64",
                    ["media_type"] = mediaType,
                    ["data"] = base64,
                },
            },
            new JsonObject
            {
                ["type"] = "text",
                ["text"] = prompt,
            });

        var nodo = await EnviarAsync(new JsonObject
        {
            ["model"] = _opt.Model,
            ["max_tokens"] = _opt.MaxTokens,
            ["system"] = system,
            ["messages"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["content"] = contenido,
            }),
        }, ct);

        return LeerPrimerBloqueDeTexto(nodo);
    }

    // ── Transporte ─────────────────────────────────────────────

    private async Task<JsonNode> EnviarAsync(JsonObject payload, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_opt.ApiKey))
        {
            logger.LogError("Anthropic:ApiKey no está configurada.");
            throw new AnthropicException("La inteligencia artificial no está configurada en este servidor.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "v1/messages");
        request.Headers.TryAddWithoutValidation("x-api-key", _opt.ApiKey);
        request.Headers.TryAddWithoutValidation("anthropic-version", Version);
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
            logger.LogError("Timeout hablando con la API de Anthropic tras {Timeout}.", _opt.Timeout);
            throw new AnthropicException("La IA tardó demasiado en responder. Inténtalo de nuevo.", reintentable: true);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Fallo de red al llamar a la API de Anthropic.");
            throw new AnthropicException("No se pudo contactar con el servicio de IA. Revisa tu conexión.", reintentable: true);
        }

        using (respuesta)
        {
            var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);

            if (!respuesta.IsSuccessStatusCode)
            {
                logger.LogError("Anthropic respondio {Status}: {Body}", (int)respuesta.StatusCode, Recortar(cuerpo, 800));
                throw TraducirError(respuesta.StatusCode, cuerpo);
            }

            try
            {
                return JsonNode.Parse(cuerpo)!;
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Respuesta 200 de Anthropic con cuerpo no-JSON: {Body}", Recortar(cuerpo, 500));
                throw new AnthropicException("El servicio de IA devolvió una respuesta inesperada.");
            }
        }
    }

    private static AnthropicException TraducirError(System.Net.HttpStatusCode status, string cuerpo)
    {
        var mensajeApi = JsonNode.Parse(cuerpo)?["error"]?["message"]?.GetValue<string>();

        return status switch
        {
            System.Net.HttpStatusCode.TooManyRequests =>
                new AnthropicException("Se alcanzó el límite de peticiones a la IA. Espera un momento e inténtalo de nuevo.", reintentable: true),

            System.Net.HttpStatusCode.ServiceUnavailable or System.Net.HttpStatusCode.BadGateway =>
                new AnthropicException("El servicio de IA está temporalmente saturado. Inténtalo en unos minutos.", reintentable: true),

            (System.Net.HttpStatusCode)401 or (System.Net.HttpStatusCode)403 =>
                new AnthropicException("La clave de la IA es inválida o no tiene permisos. Revisa la configuración del servidor."),

            (System.Net.HttpStatusCode)400 when mensajeApi?.Contains("credit balance", StringComparison.OrdinalIgnoreCase) == true =>
                new AnthropicException("La cuenta del servicio de IA no tiene saldo disponible."),

            _ => new AnthropicException("No se pudo completar la solicitud a la IA."),
        };
    }

    private static string LeerPrimerBloqueDeTexto(JsonNode nodo)
    {
        var contenido = nodo["content"] as JsonArray;
        var texto = contenido?
            .OfType<JsonObject>()
            .FirstOrDefault(b => b["type"]?.GetValue<string>() == "text")?["text"]?
            .GetValue<string>();

        return string.IsNullOrWhiteSpace(texto)
            ? throw new AnthropicException("La IA devolvió una respuesta vacía.")
            : texto;
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
        if (coma < 0) throw new AnthropicException("La imagen adjunta tiene un formato no válido.");

        var cabecera = dataUri[..coma];              // data:image/png;base64
        var cuerpo = dataUri[(coma + 1)..];

        var tipo = cabecera.Split(';')[0].Split(':').LastOrDefault();
        if (string.IsNullOrWhiteSpace(tipo) || !tipo.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            throw new AnthropicException("Solo se pueden adjuntar imágenes a la IA.");

        return (tipo, cuerpo);
    }

    private static string Recortar(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
