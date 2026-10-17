using System.Net;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Services.Common;
using SugoiNote.Services.Ia;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del cliente de Google Gemini. Se sustituye la red por un manejador HTTP falso,
/// así se prueban la traducción de errores, el descarte de bloques de razonamiento y el parseo.
/// </summary>
public class GeminiClientTests
{
    private static (GeminiClient Cliente, StubHttpMessageHandler Handler) Crear(
        Func<HttpRequestMessage, HttpResponseMessage> responder, string apiKey = "clave-de-prueba")
    {
        var handler = new StubHttpMessageHandler(responder);
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://ia.test/") };
        var cliente = new GeminiClient(http, Datos.Opciones(new IaOptions { ApiKey = apiKey }),
            NullLogger<GeminiClient>.Instance);

        return (cliente, handler);
    }

    private static GeminiClient Ok(string cuerpo) => Crear(_ => Respuesta.Ok(cuerpo)).Cliente;

    [Fact]
    public async Task TextoAsync_DevuelveElTexto()
    {
        var cliente = Ok(Respuesta.GeminiTexto("hola mundo"));

        Assert.Equal("hola mundo", await cliente.TextoAsync("sys", "prompt"));
    }

    [Fact]
    public async Task TextoAsync_DescartaLosBloquesDeRazonamiento()
    {
        const string cuerpo = """
            {"candidates":[{"content":{"parts":[{"text":"borrador interno","thought":true},{"text":"respuesta final"}]}}]}
            """;

        Assert.Equal("respuesta final", await Ok(cuerpo).TextoAsync("sys", "prompt"));
    }

    [Fact]
    public async Task TextoAsync_UneVariosBloquesDeTexto()
    {
        const string cuerpo = """
            {"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}
            """;

        Assert.Equal("ab", await Ok(cuerpo).TextoAsync("sys", "prompt"));
    }

    [Fact]
    public async Task TextoAsync_SinCandidatosConMotivoDeBloqueo()
    {
        var ex = await Assert.ThrowsAsync<IaException>(() =>
            Ok("""{"promptFeedback":{"blockReason":"SAFETY"}}""").TextoAsync("s", "p"));

        Assert.Contains("filtros", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_SinCandidatosNiMotivo_RespuestaVacia()
    {
        var ex = await Assert.ThrowsAsync<IaException>(() => Ok("{}").TextoAsync("s", "p"));

        Assert.Contains("vacía", ex.Message);
    }

    [Theory]
    [InlineData("SAFETY")]
    [InlineData("PROHIBITED_CONTENT")]
    [InlineData("BLOCKLIST")]
    public async Task TextoAsync_FinishReasonDeSeguridad(string motivo)
    {
        var cuerpo = new JsonObject
        {
            ["candidates"] = new JsonArray(new JsonObject
            {
                ["finishReason"] = motivo,
                ["content"] = new JsonObject { ["parts"] = new JsonArray() },
            }),
        }.ToJsonString();

        var ex = await Assert.ThrowsAsync<IaException>(() => Ok(cuerpo).TextoAsync("s", "p"));

        Assert.Contains("filtros", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_RespuestaCortadaPorMaxTokens()
    {
        const string cuerpo = """{"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[]}}]}""";

        var ex = await Assert.ThrowsAsync<IaException>(() => Ok(cuerpo).TextoAsync("s", "p"));

        Assert.Contains("corto", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_SinApiKeyConfigurada()
    {
        var (cliente, _) = Crear(_ => Respuesta.Ok("{}"), apiKey: "");

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("no está configurada", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_LimiteDePeticiones_EsReintentable()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.TooManyRequests,
            """{"error":{"message":"quota exceeded"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.True(ex.Reintentable);
        Assert.Contains("límite", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_ClaveInvalida()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.Unauthorized,
            """{"error":{"message":"bad key"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("clave", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task TextoAsync_BadRequestConMensajeDeApiKey()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.BadRequest,
            """{"error":{"message":"API key not valid"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("clave", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task TextoAsync_ModeloNoEncontrado()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.NotFound,
            """{"error":{"message":"not found"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("no existe", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_ModeloRetirado()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.NotFound,
            """{"error":{"message":"model is no longer available"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("ya no está disponible", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_ServicioSaturado_EsReintentable()
    {
        var (cliente, _) = Crear(_ => Respuesta.Json(HttpStatusCode.ServiceUnavailable,
            """{"error":{"message":"busy"}}"""));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.True(ex.Reintentable);
    }

    [Fact]
    public async Task TextoAsync_CuerpoNoJson()
    {
        var (cliente, _) = Crear(_ => Respuesta.Ok("esto no es json"));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.Contains("inesperada", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_FalloDeRed_EsReintentable()
    {
        var (cliente, _) = Crear(_ => throw new HttpRequestException("sin red"));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.True(ex.Reintentable);
        Assert.Contains("conexión", ex.Message);
    }

    [Fact]
    public async Task TextoAsync_Timeout_EsReintentable()
    {
        var (cliente, _) = Crear(_ => throw new TaskCanceledException());

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.TextoAsync("s", "p"));

        Assert.True(ex.Reintentable);
    }

    [Fact]
    public async Task TextoAsync_UsaElModeloRapidoCuandoSePide()
    {
        var (cliente, handler) = Crear(_ => Respuesta.Ok(Respuesta.GeminiTexto("ok")));

        await cliente.TextoAsync("s", "p", rapido: true);

        Assert.Contains("gemini-3.1-flash-lite", handler.UltimaUrl!);
    }

    [Fact]
    public async Task JsonAsync_ParseaRespuestaEntreFences()
    {
        var cliente = Ok(Respuesta.GeminiTexto("```json\n{\"a\":1}\n```"));

        var nodo = await cliente.JsonAsync("s", "p");

        Assert.Equal(1, nodo["a"]!.GetValue<int>());
    }

    [Fact]
    public async Task JsonAsync_PideRespuestaJsonAlModelo()
    {
        var (cliente, handler) = Crear(_ => Respuesta.Ok(Respuesta.GeminiTexto("{\"a\":1}")));

        await cliente.JsonAsync("s", "p");

        Assert.Contains("application/json", handler.UltimoCuerpo!);
    }

    [Fact]
    public async Task JsonAsync_FallaSiLaRespuestaNoEsJson()
    {
        var cliente = Ok(Respuesta.GeminiTexto("esto no es json"));

        var ex = await Assert.ThrowsAsync<IaException>(() => cliente.JsonAsync("s", "p"));

        Assert.Contains("formato", ex.Message);
    }

    [Fact]
    public async Task TextoConImagen_EnviaLaImagenComoInlineData()
    {
        var (cliente, handler) = Crear(_ => Respuesta.Ok(Respuesta.GeminiTexto("ok")));

        await cliente.TextoConImagenAsync("s", "p", "data:image/png;base64,AAAA");

        Assert.Contains("inlineData", handler.UltimoCuerpo!);
        Assert.Contains("image/png", handler.UltimoCuerpo!);
    }

    [Fact]
    public async Task TextoConImagen_RechazaDataUriSinComa()
    {
        var ex = await Assert.ThrowsAsync<IaException>(() =>
            Ok("{}").TextoConImagenAsync("s", "p", "sincoma"));

        Assert.Contains("formato", ex.Message);
    }

    [Fact]
    public async Task TextoConImagen_RechazaTiposQueNoSonImagen()
    {
        var ex = await Assert.ThrowsAsync<IaException>(() =>
            Ok("{}").TextoConImagenAsync("s", "p", "data:text/plain;base64,AAAA"));

        Assert.Contains("imágenes", ex.Message);
    }

    [Theory]
    [InlineData("{\"a\":1}", "{\"a\":1}")]
    [InlineData("```json\n{\"a\":1}\n```", "{\"a\":1}")]
    [InlineData("texto antes {\"a\":1} texto después", "{\"a\":1}")]
    [InlineData("[1,2,3]", "[1,2,3]")]
    [InlineData("{\"a\":{\"b\":2}}", "{\"a\":{\"b\":2}}")]
    public void ExtraerJson_RecortaElJsonDelTexto(string entrada, string esperado)
        => Assert.Equal(esperado, GeminiClient.ExtraerJson(entrada));
}
