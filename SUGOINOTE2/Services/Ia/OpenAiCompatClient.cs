using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Ia;

/// <summary>
/// Cliente para cualquier servicio compatible con la API de OpenAI (DeepSeek, ModelScope,
/// AIML API, Groq, Together, etc.). Se activa con <c>IA:Proveedor = "openai"</c> y se
/// configura con <c>IA:BaseUrl</c>, <c>IA:ApiKey</c>, <c>IA:Model</c> y <c>IA:ModelFast</c>.
/// La interfaz es la misma (<see cref="IIaClient"/>) para que los servicios no cambien.
/// </summary>
public sealed class OpenAiCompatClient(
    HttpClient http,
    IOptions<IaOptions> options,
    ILogger<OpenAiCompatClient> logger) : IIaClient
{
    private readonly IaOptions _opt = options.Value;

    public Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
        => EnviarAsync(system, prompt, rapido, imagen: null, ct);

    public async Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        var systemJson = system + "\n\nIMPORTANTE: responde EXCLUSIVAMENTE con JSON válido. Sin texto antes ni después, sin bloques de código markdown.";

        var texto = await EnviarAsync(systemJson, prompt, rapido, imagen: null, ct, json: true);

        var limpio = GeminiClient.ExtraerJson(texto);
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

    public Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default)
        => EnviarAsync(system, prompt, rapido: false, imagen: dataUri, ct);

    // ── Transporte ─────────────────────────────────────────────

    private async Task<string> EnviarAsync(
        string system, string prompt, bool rapido, string? imagen, CancellationToken ct, bool json = false)
    {
        if (string.IsNullOrWhiteSpace(_opt.ApiKey))
        {
            logger.LogError("IA:ApiKey no está configurada.");
            throw new IaException("La inteligencia artificial no está configurada en este servidor.");
        }

        var modelo = rapido ? _opt.ModelFast : _opt.Model;

        JsonNode contenido = imagen is null
            ? JsonValue.Create(prompt)!
            : new JsonArray(
                new JsonObject { ["type"] = "text", ["text"] = prompt },
                new JsonObject
                {
                    ["type"] = "image_url",
                    ["image_url"] = new JsonObject { ["url"] = imagen },
                });

        var payload = new JsonObject
        {
            ["model"] = modelo,
            ["messages"] = new JsonArray(
                new JsonObject { ["role"] = "system", ["content"] = system },
                new JsonObject { ["role"] = "user", ["content"] = contenido }),
            ["max_tokens"] = _opt.MaxTokens,
            ["temperature"] = 0.7,
        };

        if (json) payload["response_format"] = new JsonObject { ["type"] = "json_object" };

        var (status, cuerpo) = await PostAsync(payload, ct);

        // Algunos proveedores no admiten response_format: se reintenta sin él.
        if (json && status == System.Net.HttpStatusCode.BadRequest
                 && cuerpo.Contains("response_format", StringComparison.OrdinalIgnoreCase))
        {
            payload.Remove("response_format");
            (status, cuerpo) = await PostAsync(payload, ct);
        }

        if ((int)status is < 200 or >= 300)
        {
            logger.LogError("La API de IA respondió {Status}: {Body}", (int)status, Recortar(cuerpo, 800));
            throw TraducirError(status, cuerpo);
        }

        JsonNode? nodo;
        try
        {
            nodo = JsonNode.Parse(cuerpo);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Respuesta 200 de la IA con cuerpo no-JSON: {Body}", Recortar(cuerpo, 500));
            throw new IaException("El servicio de IA devolvió una respuesta inesperada.");
        }

        var eleccion = (nodo?["choices"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault()
                       ?? throw new IaException("La IA devolvió una respuesta vacía.");

        var texto = LeerContenido(eleccion["message"]?["content"]);

        if (!string.IsNullOrWhiteSpace(texto)) return texto;

        return eleccion["finish_reason"]?.GetValue<string>() switch
        {
            "content_filter" =>
                throw new IaException("La IA rechazó la solicitud por sus filtros de contenido. Cambia el texto e inténtalo de nuevo."),

            "length" =>
                throw new IaException("La IA se quedó sin espacio en la respuesta. Prueba con un texto más corto."),

            _ => throw new IaException("La IA devolvió una respuesta vacía."),
        };
    }

    private async Task<(System.Net.HttpStatusCode Status, string Cuerpo)> PostAsync(JsonNode payload, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(payload.ToJsonString(), Encoding.UTF8),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _opt.ApiKey);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        HttpResponseMessage respuesta;
        try
        {
            respuesta = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogError("Timeout hablando con la API de IA tras {Timeout}.", _opt.Timeout);
            throw new IaException("La IA tardó demasiado en responder. Inténtalo de nuevo.", reintentable: true);
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Fallo de red al llamar a la API de IA.");
            throw new IaException("No se pudo contactar con el servicio de IA. Revisa tu conexión.", reintentable: true);
        }

        using (respuesta)
        {
            var cuerpo = await respuesta.Content.ReadAsStringAsync(ct);
            return (respuesta.StatusCode, cuerpo);
        }
    }

    /// <summary>El contenido puede venir como texto o como lista de bloques (algunos proveedores).</summary>
    private static string LeerContenido(JsonNode? contenido)
    {
        if (contenido is null) return string.Empty;

        if (contenido is JsonValue valor && valor.TryGetValue<string>(out var simple))
            return simple ?? string.Empty;

        if (contenido is JsonArray bloques)
        {
            return string.Concat(bloques
                .OfType<JsonObject>()
                .Select(b => b["text"]?.GetValue<string>())
                .Where(t => !string.IsNullOrEmpty(t)));
        }

        return string.Empty;
    }

    private static IaException TraducirError(System.Net.HttpStatusCode status, string cuerpo)
    {
        string mensajeApi = string.Empty;
        try
        {
            var nodo = JsonNode.Parse(cuerpo);
            mensajeApi = nodo?["error"]?["message"]?.GetValue<string>()
                         ?? nodo?["message"]?.GetValue<string>()
                         ?? string.Empty;
        }
        catch (JsonException)
        {
            // El cuerpo de error no era JSON: se usa el mensaje genérico.
        }

        return status switch
        {
            System.Net.HttpStatusCode.TooManyRequests =>
                new IaException("Se alcanzó el límite de peticiones de la IA. Espera un momento e inténtalo de nuevo.", reintentable: true),

            System.Net.HttpStatusCode.ServiceUnavailable or System.Net.HttpStatusCode.BadGateway
                or System.Net.HttpStatusCode.InternalServerError =>
                new IaException("El servicio de IA está temporalmente saturado. Inténtalo en unos minutos.", reintentable: true),

            System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden =>
                new IaException("La clave de la IA es inválida o no tiene permisos. Revisa la configuración del servidor."),

            System.Net.HttpStatusCode.NotFound =>
                new IaException("El modelo de IA configurado no existe. Revisa la configuración del servidor."),

            System.Net.HttpStatusCode.BadRequest when mensajeApi.Contains("model", StringComparison.OrdinalIgnoreCase) =>
                new IaException("El modelo de IA configurado no existe. Revisa la configuración del servidor."),

            _ => new IaException("No se pudo completar la solicitud a la IA."),
        };
    }

    private static string Recortar(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
