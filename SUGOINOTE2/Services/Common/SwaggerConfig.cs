// Swashbuckle 10 usa Microsoft.OpenApi v2, donde los tipos viven en el namespace
// raiz `Microsoft.OpenApi` (antes era `Microsoft.OpenApi.Models`).
using Microsoft.OpenApi;

namespace SugoiNote.Services.Common;

/// <summary>
/// Configuración de Swagger/OpenAPI. Vive aparte de <c>Program.cs</c> para no cargar
/// el arranque con un bloque largo y para poder reutilizarla desde las pruebas.
/// </summary>
public static class SwaggerConfig
{
    /// <summary>Nombre del esquema de seguridad para la cookie del cliente web.</summary>
    public const string CookieScheme = "cookie";

    /// <summary>Nombre del esquema de seguridad para el token JWT de la app móvil.</summary>
    public const string BearerScheme = "Bearer";

    public static IServiceCollection AddSugoiSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();

        services.AddSwaggerGen(o =>
        {
            o.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "SugoiNote API",
                Version = "v1",
                Description =
                    "API de SugoiNote: apuntes con editor de bloques, resumenes y examenes " +
                    "generados con IA, chat, comunidad y perfil de estudiante.\n\n" +
                    "**Dos formas de autenticarse:**\n\n" +
                    "* **Cookie** (`SugoiNote.Auth`): la usa el cliente web. En Swagger ejecuta " +
                    "`Auth/Login` y la cookie se guarda sola en el navegador.\n\n" +
                    "* **Bearer (JWT)**: la usa la app movil. Ejecuta `ApiAuth/Login`, copia el " +
                    "`token` de la respuesta y pegalo en el boton **Authorize**."
            });

            // Los <summary> de los controladores describen cada endpoint.
            var xml = Path.Combine(AppContext.BaseDirectory,
                $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml");
            if (File.Exists(xml)) o.IncludeXmlComments(xml);

            // Swagger no tiene esquema nativo para cookies: se declara a mano.
            o.AddSecurityDefinition(CookieScheme, new OpenApiSecurityScheme
            {
                Name = "SugoiNote.Auth",
                Type = SecuritySchemeType.ApiKey,
                In = ParameterLocation.Cookie,
                Description = "Sesion del cliente web. Se obtiene con Auth/Login.",
            });

            o.AddSecurityDefinition(BearerScheme, new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Token JWT. Se obtiene con POST /ApiAuth/Login.",
            });
        });

        return services;
    }

    public static WebApplication UseSugoiSwagger(this WebApplication app)
    {
        app.UseSwagger();

        app.UseSwaggerUI(o =>
        {
            o.SwaggerEndpoint("/swagger/v1/swagger.json", "SugoiNote API v1");
            o.DocumentTitle = "SugoiNote API";
            o.DisplayRequestDuration();
        });

        return app;
    }
}