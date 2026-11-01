using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Swashbuckle.AspNetCore.SwaggerGen;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas de la configuracion de Swagger: comprueba que el documento v1 se
/// registra con los dos esquemas de seguridad (cookie web y Bearer movil) y que
/// la generacion de la configuracion no lanza.
/// </summary>
public class SwaggerConfigTests
{
    /// <summary>Entorno minimo: Swashbuckle lo pide para resolver la configuracion.</summary>
    private sealed class EntornoFalso : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "SugoiNote.Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    [Fact]
    public void AddSugoiSwagger_RegistraElDocumentoYLosEsquemasDeSeguridad()
    {
        var servicios = new ServiceCollection();
        servicios.AddLogging();
        servicios.AddSingleton<IWebHostEnvironment>(new EntornoFalso());
        servicios.AddSugoiSwagger();

        using var proveedor = servicios.BuildServiceProvider();
        var opciones = proveedor.GetRequiredService<IOptions<SwaggerGeneratorOptions>>().Value;

        Assert.True(opciones.SwaggerDocs.ContainsKey("v1"));
        Assert.Equal("SugoiNote API", opciones.SwaggerDocs["v1"].Title);
        Assert.NotEmpty(opciones.SecuritySchemes);
        Assert.Contains(SwaggerConfig.CookieScheme, opciones.SecuritySchemes.Keys);
        Assert.Contains(SwaggerConfig.BearerScheme, opciones.SecuritySchemes.Keys);
    }
}
