using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SugoiNote.Models;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Common;
using SugoiNote.Services.Ia;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Contexto para pruebas: SQLite en memoria. Se eligió SQLite y no el proveedor InMemory
/// porque ExamenService abre transacciones explícitas (<c>BeginTransactionAsync</c>), que el
/// proveedor InMemory no soporta. Se hereda de <see cref="Sugoinotee2Context"/> para poder
/// quitar los <c>DEFAULT getdate()</c> (función de SQL Server) que SQLite no entiende.
/// </summary>
internal sealed class TestContext(DbContextOptions<Sugoinotee2Context> options) : Sugoinotee2Context(options)
{
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        foreach (var entidad in b.Model.GetEntityTypes())
        {
            foreach (var propiedad in entidad.GetProperties())
            {
                if (propiedad.GetDefaultValueSql() is not null)
                {
                    propiedad.SetDefaultValueSql(null);
                }
            }
        }
    }
}

/// <summary>Base de datos SQLite en memoria lista para usar, con ciclo de vida propio.</summary>
internal sealed class TestDb : IDisposable
{
    private readonly SqliteConnection _conexion;

    public Sugoinotee2Context Context { get; }

    public TestDb()
    {
        // ":memory:" vive mientras la conexión esté abierta; por eso se mantiene abierta.
        // Foreign Keys=False: las pruebas siembran apuntes con EstudianteId sintéticos y no
        // nos interesa validar integridad referencial aquí (se prueba la lógica del servicio).
        _conexion = new SqliteConnection("DataSource=:memory:;Foreign Keys=False");
        _conexion.Open();

        var options = new DbContextOptionsBuilder<Sugoinotee2Context>()
            .UseSqlite(_conexion)
            .Options;

        Context = new TestContext(options);
        Context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        Context.Dispose();
        _conexion.Dispose();
    }
}

/// <summary>Cliente de IA falso y configurable, para no depender de la red.</summary>
internal sealed class FakeIaClient : IIaClient
{
    public Func<string, string, string> Texto { get; set; } = (_, _) => "<p>Resumen de prueba</p>";
    public Func<string, string, JsonNode> Json { get; set; } = (_, _) => JsonNode.Parse("{}")!;
    public Func<string, string, string, string> TextoConImagen { get; set; } = (_, _, _) => "texto";

    /// <summary>Si se asigna, todas las llamadas lanzan esta excepción.</summary>
    public Exception? Excepcion { get; set; }

    public int Llamadas { get; private set; }

    public Task<string> TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        Llamadas++;
        return Excepcion is not null
            ? Task.FromException<string>(Excepcion)
            : Task.FromResult(Texto(system, prompt));
    }

    public Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false)
    {
        Llamadas++;
        return Excepcion is not null
            ? Task.FromException<JsonNode>(Excepcion)
            : Task.FromResult(Json(system, prompt));
    }

    public Task<string> TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default)
    {
        Llamadas++;
        return Excepcion is not null
            ? Task.FromException<string>(Excepcion)
            : Task.FromResult(TextoConImagen(system, prompt, dataUri));
    }
}

/// <summary>Enviador de correo falso que además guarda lo que se habría enviado.</summary>
internal sealed class FakeEmailSender : IEmailSender
{
    public List<(string Destinatario, string Asunto, string Cuerpo)> Enviados { get; } = [];

    public bool Resultado { get; set; } = true;

    public Task<bool> EnviarAsync(string destinatario, string asunto, string cuerpoHtml, CancellationToken ct = default)
    {
        Enviados.Add((destinatario, asunto, cuerpoHtml));
        return Task.FromResult(Resultado);
    }
}

/// <summary>Manejador HTTP falso: evita salir a la red en las pruebas de <c>GeminiClient</c>.</summary>
internal sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
{
    public string? UltimoCuerpo { get; private set; }
    public string? UltimaUrl { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        UltimaUrl = request.RequestUri?.ToString();
        UltimoCuerpo = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
        return responder(request);
    }
}

/// <summary>Respuestas HTTP de apoyo para las pruebas.</summary>
internal static class Respuesta
{
    public static HttpResponseMessage Json(HttpStatusCode estado, string cuerpo) =>
        new(estado) { Content = new StringContent(cuerpo, Encoding.UTF8, "application/json") };

    public static HttpResponseMessage Ok(string cuerpo) => Json(HttpStatusCode.OK, cuerpo);

    /// <summary>Cuerpo de éxito de Gemini con un único bloque de texto.</summary>
    public static string GeminiTexto(string texto)
    {
        var cuerpo = new JsonObject
        {
            ["candidates"] = new JsonArray(new JsonObject
            {
                ["content"] = new JsonObject
                {
                    ["parts"] = new JsonArray(new JsonObject { ["text"] = texto }),
                },
            }),
        };

        return cuerpo.ToJsonString();
    }
}

/// <summary>Constructores de datos de prueba.</summary>
internal static class Datos
{
    public static Estudiante Estudiante(string nombre = "Ana Pérez", string correo = "ana@correo.com", string clave = "Clave123") =>
        new()
        {
            EstudianteId = Guid.NewGuid(),
            NombreCompleto = nombre,
            CorreoElectronico = correo,
            ClaveAcceso = BCrypt.Net.BCrypt.HashPassword(clave, workFactor: 4),
            FechaCreacion = DateTime.UtcNow,
            SecurityStamp = Guid.NewGuid().ToString("N"),
        };

    public static Apunte Apunte(Guid? estudianteId, string titulo = "Apunte de prueba", string? contenido = "<p>Contenido</p>") =>
        new()
        {
            ApunteId = Guid.NewGuid(),
            TituloNota = titulo,
            ContenidoTexto = contenido,
            EstudianteId = estudianteId,
            FechaRegistro = DateTime.UtcNow,
        };

    public static IOptions<T> Opciones<T>(T valor) where T : class => Options.Create(valor);
}
