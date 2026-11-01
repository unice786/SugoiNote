using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Chat;
using SugoiNote.Services.Ia;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del chat de IA: valida que sin mensaje no se llame al modelo, que el
/// contexto salga solo de los apuntes del estudiante y que un fallo del proveedor
/// se devuelva como error en vez de como respuesta valida.
/// </summary>
public class ChatServiceTests
{
    private static IChatService Crear(Sugoinotee2Context db, FakeIaClient ia) =>
        new ChatService(db, ia, NullLogger<ChatService>.Instance);

    [Fact]
    public async Task Responder_SinMensajeNiImagen_FallaSinLlamarAlModelo()
    {
        using var t = new TestDb();
        var ia = new FakeIaClient();

        var r = await Crear(t.Context, ia).ResponderAsync(Guid.NewGuid(), "   ", null);

        Assert.False(r.Ok);
        Assert.Contains("Escribe algo", r.Error!);
        Assert.Equal(0, ia.Llamadas);
    }

    [Fact]
    public async Task Responder_SinApuntes_UsaElMensajeDeVacio()
    {
        using var t = new TestDb();
        var ia = new FakeIaClient();
        string? promptRecibido = null;
        ia.Texto = (_, prompt) => { promptRecibido = prompt; return "respuesta"; };

        var r = await Crear(t.Context, ia).ResponderAsync(Guid.NewGuid(), "¿Que es una derivada?", null);

        Assert.True(r.Ok);
        Assert.Equal("respuesta", r.Respuesta);
        Assert.Contains("no tiene apuntes", promptRecibido!);
    }

    [Fact]
    public async Task Responder_SoloUsaApuntesDelEstudiante()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        t.Context.Apuntes.AddRange(
            new Apunte
            {
                ApunteId = Guid.NewGuid(),
                TituloNota = "Mio",
                ContenidoTexto = "<p>Derivadas propias</p>",
                EstudianteId = estudiante.EstudianteId,
                FechaRegistro = DateTime.UtcNow,
            },
            new Apunte
            {
                ApunteId = Guid.NewGuid(),
                TituloNota = "Ajeno",
                ContenidoTexto = "<p>Secreto de otro</p>",
                EstudianteId = Guid.NewGuid(),
                FechaRegistro = DateTime.UtcNow,
            });
        await t.Context.SaveChangesAsync();

        string? promptRecibido = null;
        var ia = new FakeIaClient { Texto = (_, prompt) => { promptRecibido = prompt; return "ok"; } };

        await Crear(t.Context, ia).ResponderAsync(estudiante.EstudianteId, "Ayuda", null);

        Assert.Contains("Derivadas propias", promptRecibido!);
        Assert.DoesNotContain("Secreto de otro", promptRecibido!);
    }

    [Fact]
    public async Task Responder_ApuntesSinTexto_UsaElMensajeDeApuntesVacios()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        t.Context.Apuntes.Add(new Apunte
        {
            ApunteId = Guid.NewGuid(),
            TituloNota = "Vacio",
            ContenidoTexto = "<p>   </p>",
            EstudianteId = estudiante.EstudianteId,
            FechaRegistro = DateTime.UtcNow,
        });
        await t.Context.SaveChangesAsync();

        string? promptRecibido = null;
        var ia = new FakeIaClient { Texto = (_, prompt) => { promptRecibido = prompt; return "ok"; } };

        await Crear(t.Context, ia).ResponderAsync(estudiante.EstudianteId, "Ayuda", null);

        Assert.Contains("estan vacios", promptRecibido!);
    }

    [Fact]
    public async Task Responder_ConImagen_UsaLaVarianteConImagen()
    {
        using var t = new TestDb();
        var dataUri = "data:image/png;base64,iVBORw0KGgo=";
        string? imagenRecibida = null;
        var ia = new FakeIaClient
        {
            TextoConImagen = (_, _, imagen) => { imagenRecibida = imagen; return "descrito"; },
        };

        var r = await Crear(t.Context, ia).ResponderAsync(Guid.NewGuid(), "", dataUri);

        Assert.True(r.Ok);
        Assert.Equal("descrito", r.Respuesta);
        Assert.Equal(dataUri, imagenRecibida);
    }

    [Fact]
    public async Task Responder_FalloDelProveedor_DevuelveError()
    {
        using var t = new TestDb();
        var ia = new FakeIaClient { Excepcion = new IaException("El modelo esta saturado.") };

        var r = await Crear(t.Context, ia).ResponderAsync(Guid.NewGuid(), "Hola", null);

        Assert.False(r.Ok);
        Assert.Contains("saturado", r.Error!);
    }
}
