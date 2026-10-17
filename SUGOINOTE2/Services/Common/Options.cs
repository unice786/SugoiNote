namespace SugoiNote.Services.Common;

/// <summary>Límites de negocio configurables (sección <c>Limites</c> de appsettings).</summary>
public class LimitesOptions
{
    public const string SectionName = "Limites";

    /// <summary>Tope de una imagen subida (avatar, post, imagen del editor). Default 2 MB.</summary>
    public long MaxBytesImagen { get; set; } = 2 * 1024 * 1024;

    /// <summary>Tope de un documento importado al editor. Default 10 MB.</summary>
    public long MaxBytesDocumento { get; set; } = 10 * 1024 * 1024;

    /// <summary>Tope de preguntas por examen generado. Default 50.</summary>
    public int MaxCantidadPreguntas { get; set; } = 50;
}

public class IaOptions
{
    public const string SectionName = "IA";

    public string ApiKey { get; set; } = string.Empty;

    // Modelos validados contra GET /v1beta/models de Google AI Studio (plan gratuito).
    // Si Google retira un modelo, la API responde 404 con "no longer available":
    // GeminiClient lo traduce a un mensaje claro para el usuario.
    public string Model { get; set; } = "gemini-3.8-flash";
    public string ModelFast { get; set; } = "gemini-3.1-flash-lite";

    /// <summary>Timeout total por llamada a la API. Es el tope del HttpClient, por encima
    /// de los timeouts de Polly: se midió un resumen real tardando 79 s.</summary>
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(180);

    /// <summary>Máximo de tokens de la respuesta.</summary>
    public int MaxTokens { get; set; } = 8000;
}

public class EmailOptions
{
    public const string SectionName = "Email";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 25;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Remitente { get; set; } = "no-reply@sugoinote.local";
    public bool Ssl { get; set; }

    /// <summary>
    /// Si es true, el email se escribe en el log en vez de enviarse. Útil en desarrollo
    /// para no depender de un SMTP real.
    /// </summary>
    public bool SoloLog { get; set; } = true;
}

/// <summary>
/// Configuracion del token JWT que consume la app movil.
/// La web no la usa: sigue con la cookie de sesion.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "SugoiNote";

    public string Audience { get; set; } = "SugoiNoteMobile";

    /// <summary>Clave de firma. Minimo 32 caracteres (HMAC-SHA256).</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>Duracion del token. Por defecto 7 dias, igual que la cookie.</summary>
    public int ExpiracionHoras { get; set; } = 168;
}