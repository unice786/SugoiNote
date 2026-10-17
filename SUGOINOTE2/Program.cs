using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;
using SugoiNote.Models;
using SugoiNote.Services.Ia;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Chat;
using SugoiNote.Services.Common;
using SugoiNote.Services.Comunidad;
using SugoiNote.Services.Examenes;
using SugoiNote.Services.Perfiles;
using SugoiNote.Services.Resumenes;

// ─────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(Host.CreateApplicationBuilder(args).Configuration)
    .WriteTo.Console()
    .Enrich.FromLogContext()

    // Sin esto Serilog ignora la seccion "Logging" de appsettings.json y escupe
    // cada comando SQL a nivel Information: la consola quedaba tapada y los
    // errores de verdad se perdian entre cientos de lineas de EF.
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Migrations", Serilog.Events.LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog();

// ─────────────────────────────────────────────────────────────
// Configuración validada
// ─────────────────────────────────────────────────────────────
var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connStr))
{
    Log.Fatal("Falta la cadena de conexión. Configúrala con 'dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\"' o con la variable de entorno ConnectionStrings__DefaultConnection.");
    return 1;
}

builder.Services.AddOptions<IaOptions>()
    .Bind(builder.Configuration.GetSection(IaOptions.SectionName))
    .Validate(o => !string.IsNullOrWhiteSpace(o.ApiKey),
              "IA:ApiKey no está configurada. Las funciones de IA quedarán deshabilitadas.")
    .ValidateOnStart();

builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName));

builder.Services.AddOptions<LimitesOptions>()
    .Bind(builder.Configuration.GetSection(LimitesOptions.SectionName));

// La app movil no puede manejar cookies, asi que tambien emitimos JWT.
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(o => !string.IsNullOrWhiteSpace(o.Key) && o.Key.Length >= 32,
              "Jwt:Key debe estar configurada y tener al menos 32 caracteres. "
            + "Configúrala con 'dotnet user-secrets set \"Jwt:Key\" \"...\"' o la variable Jwt__Key.")
    .ValidateOnStart();

Configuracion.UrlBase = builder.Configuration["App:UrlBase"]
    ?? $"{builder.Configuration["ASPNETCORE_URLS"]?.Split(';')[0]}"
    ?? "https://localhost:7244";

// ─────────────────────────────────────────────────────────────
// Base de datos
// ─────────────────────────────────────────────────────────────
builder.Services.AddDbContext<Sugoinotee2Context>(opt =>
{
    opt.UseSqlServer(connStr, sql =>
    {
        sql.EnableRetryOnFailure(maxRetryCount: 3, TimeSpan.FromSeconds(5), null);
        sql.CommandTimeout(60);
    });
});

// ─────────────────────────────────────────────────────────────
// Servicios de aplicación
// ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<IHtmlSanitizer, SugoiHtmlSanitizer>();

builder.Services.AddScoped<IApunteService, ApunteService>();
builder.Services.AddScoped<IExamenService, ExamenService>();
builder.Services.AddScoped<IResumenService, ResumenService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IComunidadService, ComunidadService>();
builder.Services.AddScoped<IPerfilService, PerfilService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IEmailSender, EmailSender>();

// Cliente de Google Gemini (Google AI Studio) con timeout, reintentos y circuit
// breaker (Polly). Sustituye a la capa de Anthropic, que quedó sin saldo y dejaba
// los resúmenes, exámenes y el chat sin IA.
builder.Services.AddHttpClient<IIaClient, GeminiClient>((sp, http) =>
{
    var opt = sp.GetRequiredService<IOptions<IaOptions>>().Value;
    http.BaseAddress = new Uri("https://generativelanguage.googleapis.com/");
    http.Timeout = opt.Timeout;
    http.DefaultRequestHeaders.UserAgent.ParseAdd("SugoiNote/1.0");
})
.AddStandardResilienceHandler(o =>
{
    o.Retry.MaxRetryAttempts = 2;
    o.Retry.Delay = TimeSpan.FromSeconds(2);
    o.Retry.UseJitter = true;

    // Solo reintentamos errores de red y respuestas 5xx.
    //  - Un 429 significa que el plan gratuito ya se agotó: reintentarlo gasta más cuota,
    //    así que se devuelve el mensaje "límite alcanzado" al usuario de inmediato.
    //  - Un timeout NO se reintenta: si una llamada ya tardó 120 s, hacer esperar al
    //    usuario otros 120 s es peor que devolverle el error.
    o.Retry.ShouldHandle = args => ValueTask.FromResult(
        args.Outcome.Exception is HttpRequestException
        || (args.Outcome.Result is { IsSuccessStatusCode: false } r && (int)r.StatusCode >= 500));

    // Los modelos con razonamiento pueden tardar: se midió un resumen real en 79 s.
    o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(120);

    // Tope global de la operación (incluidos los reintentos). Ligeramente por debajo del
    // HttpClient.Timeout (IaOptions.Timeout) para que el error lo dé Polly con su mensaje.
    o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(175);

    // Polly exige que la ventana de muestreo sea al menos el doble del timeout de
    // intento; con 120 s de intento hacen falta 240 s o más.
    o.CircuitBreaker.FailureRatio = 0.5;
    o.CircuitBreaker.MinimumThroughput = 8;
    o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(240);
    o.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(30);
});

// ─────────────────────────────────────────────────────────────
// MVC + global antiforgery
// ─────────────────────────────────────────────────────────────
builder.Services
    .AddControllersWithViews(o =>
    {
        // FIX C8: antes solo 6 endpoints de 17 validaban el token antifalsificacion.
        o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    })
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = 12 * 1024 * 1024);

// Documentacion interactiva de la API en /swagger (ver Services/Common/SwaggerConfig.cs).
builder.Services.AddSugoiSwagger();

// ─────────────────────────────────────────────────────────────
// Autenticación por cookie
// ─────────────────────────────────────────────────────────────
builder.Services
    .AddAuthentication(o =>
    {
        // Esquema "inteligente": decide en cada peticion segun las cabeceras.
        // Asi los [Authorize] de los controladores sirven tal cual para la web
        // (cookie) y para el movil (Bearer), sin duplicar las politicas.
        o.DefaultScheme = "CookieOBearer";
        o.DefaultChallengeScheme = "CookieOBearer";
    })
    .AddPolicyScheme("CookieOBearer", "Cookie (web) o Bearer (movil)", o =>
    {
        o.ForwardDefaultSelector = ctx =>
        {
            var cabecera = ctx.Request.Headers.Authorization.ToString();
            return cabecera.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? JwtBearerDefaults.AuthenticationScheme
                : CookieAuthenticationDefaults.AuthenticationScheme;
        };
    })
    .AddCookie(o =>
    {
        o.LoginPath = "/Auth/Login";
        o.LogoutPath = "/Auth/Logout";
        o.AccessDeniedPath = "/Auth/Login";
        o.ExpireTimeSpan = TimeSpan.FromDays(7);
        o.SlidingExpiration = true;

        // Evita la sesión fixation.
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.HttpOnly = true;
        o.Cookie.Name = "SugoiNote.Auth";

        // En producción la cookie debe viajar solo por HTTPS. En desarrollo se respeta el
        // esquema de la petición porque, si no, el navegador descarta la cookie al trabajar
        // sobre http://localhost y parece que el login "funciona" pero no hay sesión.
        o.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;

        o.Events.OnRedirectToLogin = ctx =>
        {
            if (ctx.Request.Path.StartsWithSegments("/api"))
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            }
            ctx.Response.Redirect(ctx.Request.PathBase + o.LoginPath);
            return Task.CompletedTask;
        };
    })
    .AddJwtBearer(o =>
    {
        var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

builder.Services.AddAuthorization();

// Las claves de DataProtection se persisten en la BD: si no, se regeneran en cada
// reinicio y todos los usuarios pierden la sesión.
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<Sugoinotee2Context>()
    .SetApplicationName("SugoiNote");

// ─────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────
builder.Services.AddMemoryCache();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Global: tope por IP para frenar abuso y scraping.
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "desconocido",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // Los endpoints de IA cuestan dinero: límite estricto por usuario.
    o.AddPolicy("IA", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "x",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // El login necesita un límite más estricto para frenar la fuerza bruta.
    o.AddPolicy("Login", ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "x",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
            }));
});

// ─────────────────────────────────────────────────────────────
// Health checks
// ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddDbContextCheck<Sugoinotee2Context>("base-de-datos", tags: ["bd"]);

builder.Services.AddHttpClient();

var app = builder.Build();

// ─────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────
app.UseSerilogRequestLogging();

if (!app.Environment.IsDevelopment())
{
    // FIX C9: antes apuntaba a /Home/Error, una acción que no existía.
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
else
{
    app.UseDeveloperExceptionPage();
}

app.UseStatusCodePagesWithReExecute("/Home/CodigoError", "?codigo={0}");

app.UseHttpsRedirection();
app.UseStaticFiles();

// Cabeceras de seguridad. Solo se activan fuera de desarrollo para no romper la depuración.
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
    h["Content-Security-Policy"] =
        "default-src 'self'; " +
        "img-src 'self' data: blob:; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
        "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
        // pdf.js crea su worker desde un Blob. Sin esta directiva el worker cae en
        // default-src 'self', que NO admite blob:, y el navegador lo bloquea: la
        // importacion de PDF falla con "No se pudo cargar el lector de PDF".
        "worker-src 'self' blob:; " +
        "connect-src 'self' https://generativelanguage.googleapis.com; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    await next();
});

app.UseSugoiSwagger();

app.UseRateLimiter();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

// Los controladores usan ENRUTAMIENTO CONVENCIONAL ({controller}/{action}/{id}),
// no [Route] en la clase. Por eso hace falta MapControllerRoute: MapControllers()
// solo registra acciones que llevan una plantilla de atributo explícita, y con él
// todas las rutas devolvían 404.
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Auth}/{action=Login}/{id?}");

app.MapHealthChecks("/health");

// ─────────────────────────────────────────────────────────────
// Esquema de base de datos
// ─────────────────────────────────────────────────────────────
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<Sugoinotee2Context>();

    if (db.Database.CanConnect())
    {
        await db.Database.MigrateAsync();
        Log.Information("Esquema de base de datos actualizado.");
    }
    else
    {
        Log.Warning("No se pudo conectar con la base de datos. Se continúa sin aplicar migraciones.");
    }
}
catch (Exception ex)
{
    Log.Fatal(ex, "No se pudo preparar la base de datos. Revisa la cadena de conexión.");
    return 1;
}

Log.Information("SugoiNote iniciado en {Entorno}", app.Environment.EnvironmentName);
app.Run();

return 0;