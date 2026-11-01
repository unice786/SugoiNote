using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Common;
using SugoiNote.Services.Comunidad;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas de la comunidad: listado paginado, detalle, alta de publicaciones y
/// encuestas, votos (unica y multiple) y borrado con control de propietario.
/// </summary>
public class ComunidadServiceTests
{
    private static ComunidadService Crear(Sugoinotee2Context db) =>
        new(db, new SugoiHtmlSanitizer(), NullLogger<ComunidadService>.Instance);

    private static ForoComunidad Post(Guid? autor, string titulo = "Pregunta", string tipo = "Pregunta", DateTime? fecha = null) =>
        new()
        {
            PostId = Guid.NewGuid(),
            TituloPregunta = titulo,
            DetallePregunta = "Detalle de la publicacion",
            TipoPost = tipo,
            EstudianteId = autor,
            FechaPublicacion = fecha ?? DateTime.UtcNow,
        };

    // ── Listado ────────────────────────────────────────────────

    [Fact]
    public async Task Listar_SinPublicaciones_DevuelveVacio()
    {
        using var t = new TestDb();

        var (posts, hayMas) = await Crear(t.Context).ListarAsync(Guid.NewGuid(), 0, 10);

        Assert.Empty(posts);
        Assert.False(hayMas);
    }

    [Fact]
    public async Task Listar_PaginaDeDosConTresPosts_IndicaQueHayMas()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        t.Context.ForoComunidades.AddRange(
            Post(estudiante.EstudianteId, "Uno"),
            Post(estudiante.EstudianteId, "Dos"),
            Post(estudiante.EstudianteId, "Tres"));
        await t.Context.SaveChangesAsync();

        var (posts, hayMas) = await Crear(t.Context).ListarAsync(estudiante.EstudianteId, 0, 2);

        Assert.Equal(2, posts.Count);
        Assert.True(hayMas);
    }

    [Fact]
    public async Task Listar_MarcaPropioYVotosDelEstudiante()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        var otro = Datos.Estudiante(nombre: "Luis", correo: "luis@correo.com");
        t.Context.Estudiantes.AddRange(estudiante, otro);

        var post = Post(estudiante.EstudianteId, "Encuesta", "Encuesta");
        post.OpcionesEncuesta.Add(new EncuestaOpcion
        {
            OpcionId = Guid.NewGuid(),
            PostId = post.PostId,
            TextoOpcion = "Opcion A",
            Orden = 0,
        });
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var opcion = post.OpcionesEncuesta.First();
        t.Context.EncuestaVotos.Add(new EncuestaVoto
        {
            VotoId = Guid.NewGuid(),
            PostId = post.PostId,
            OpcionId = opcion.OpcionId,
            EstudianteId = estudiante.EstudianteId,
        });
        await t.Context.SaveChangesAsync();

        var (posts, _) = await Crear(t.Context).ListarAsync(estudiante.EstudianteId, 0, 10);

        var mio = posts.Single();
        Assert.True(mio.EsMio);
        Assert.True(mio.YaVoto);
        Assert.Equal(1, mio.TotalVotos);
        Assert.Contains(opcion.OpcionId, mio.OpcionesVotadas);

        var (ajenos, _) = await Crear(t.Context).ListarAsync(otro.EstudianteId, 0, 10);
        Assert.False(ajenos.Single().EsMio);
    }

    [Fact]
    public async Task Listar_AjustaPaginaYTamanoFueraDeRango()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        t.Context.ForoComunidades.Add(Post(estudiante.EstudianteId));
        await t.Context.SaveChangesAsync();

        var (posts, hayMas) = await Crear(t.Context).ListarAsync(estudiante.EstudianteId, -3, 0);

        Assert.Single(posts);
        Assert.False(hayMas);
    }

    [Fact]
    public async Task Listar_DescartaImagenConEsquemaPeligroso()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId);
        post.ImagenUrl = "javascript:alert(1)";
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var (posts, _) = await Crear(t.Context).ListarAsync(estudiante.EstudianteId, 0, 10);

        Assert.Null(posts.Single().ImagenUrl);
    }

    // ── Detalle ────────────────────────────────────────────────

    [Fact]
    public async Task Obtener_Inexistente_DevuelveNull()
    {
        using var t = new TestDb();

        Assert.Null(await Crear(t.Context).ObtenerAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task Obtener_ConRespuestasYVotos_ArmaElDetalle()
    {
        using var t = new TestDb();
        var autor = Datos.Estudiante();
        var lector = Datos.Estudiante(nombre: "Luis", correo: "luis@correo.com");
        t.Context.Estudiantes.AddRange(autor, lector);

        var post = Post(autor.EstudianteId, "Encuesta", "Encuesta");
        var opcion = new EncuestaOpcion
        {
            OpcionId = Guid.NewGuid(),
            PostId = post.PostId,
            TextoOpcion = "Si",
            Orden = 0,
        };
        post.OpcionesEncuesta.Add(opcion);
        post.Respuestas.Add(new RespuestaForo
        {
            RespuestaId = Guid.NewGuid(),
            PostId = post.PostId,
            EstudianteId = lector.EstudianteId,
            TextoRespuesta = "Buena pregunta",
            FechaRespuesta = DateTime.UtcNow,
        });
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        t.Context.EncuestaVotos.Add(new EncuestaVoto
        {
            VotoId = Guid.NewGuid(),
            PostId = post.PostId,
            OpcionId = opcion.OpcionId,
            EstudianteId = lector.EstudianteId,
        });
        await t.Context.SaveChangesAsync();

        var detalle = await Crear(t.Context).ObtenerAsync(post.PostId, lector.EstudianteId);

        Assert.NotNull(detalle);
        Assert.Equal("Buena pregunta", Assert.Single(detalle!.Respuestas).TextoRespuesta);
        Assert.True(detalle.YaVoto);
        Assert.False(detalle.EsMio);
        Assert.Equal(1, detalle.TotalVotos);
    }

    // ── Alta de publicaciones ──────────────────────────────────

    [Fact]
    public async Task CrearPost_SinTitulo_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearPostAsync(Guid.NewGuid(), "   ", "Detalle", null);

        Assert.False(r.Ok);
        Assert.Contains("título", r.Error!);
    }

    [Fact]
    public async Task CrearPost_SinDetalle_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearPostAsync(Guid.NewGuid(), "Titulo", "", null);

        Assert.False(r.Ok);
        Assert.Contains("contenido", r.Error!);
    }

    [Fact]
    public async Task CrearPost_TituloLargo_SeRecortaA200()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearPostAsync(Guid.NewGuid(), new string('a', 260), "Detalle", null);

        Assert.True(r.Ok);
        Assert.Equal(200, t.Context.ForoComunidades.Single().TituloPregunta.Length);
    }

    [Fact]
    public async Task CrearPost_DescartaImagenPeligrosa()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearPostAsync(Guid.NewGuid(), "Titulo", "Detalle", "data:text/html;base64,PHNjcmlwdD4=");

        Assert.True(r.Ok);
        Assert.Null(t.Context.ForoComunidades.Single().ImagenUrl);
    }

    [Fact]
    public async Task CrearPost_DatosValidos_GuardaYDevuelveId()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).CrearPostAsync(estudiante.EstudianteId, "Titulo", "Detalle", null);

        Assert.True(r.Ok);
        Assert.NotNull(r.PostId);
        var guardado = t.Context.ForoComunidades.Single();
        Assert.Equal("Pregunta", guardado.TipoPost);
        Assert.Equal(estudiante.EstudianteId, guardado.EstudianteId);
    }

    // ── Encuestas ──────────────────────────────────────────────

    [Fact]
    public async Task CrearEncuesta_SinTitulo_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearEncuestaAsync(Guid.NewGuid(), "", "Detalle", ["A", "B"], null, true);

        Assert.False(r.Ok);
    }

    [Fact]
    public async Task CrearEncuesta_ConMenosDeDosOpciones_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearEncuestaAsync(Guid.NewGuid(), "Titulo", "Detalle", ["A", "a", "  "], null, true);

        Assert.False(r.Ok);
        Assert.Contains("2 opciones", r.Error!);
    }

    [Fact]
    public async Task CrearEncuesta_ConMasDeDiezOpciones_Falla()
    {
        using var t = new TestDb();
        var opciones = Enumerable.Range(1, 11).Select(i => $"Opcion {i}").ToList();

        var r = await Crear(t.Context).CrearEncuestaAsync(Guid.NewGuid(), "Titulo", "Detalle", opciones, null, true);

        Assert.False(r.Ok);
        Assert.Contains("10 opciones", r.Error!);
    }

    [Fact]
    public async Task CrearEncuesta_OpcionDemasiadoLarga_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearEncuestaAsync(Guid.NewGuid(), "Titulo", "Detalle", ["A", new string('x', 251)], null, true);

        Assert.False(r.Ok);
        Assert.Contains("250", r.Error!);
    }

    [Fact]
    public async Task CrearEncuesta_DatosValidos_DeduplicaYOrdena()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).CrearEncuestaAsync(Guid.NewGuid(), "Titulo", "  ", [" Rojo ", "AZUL", "rojo"], null, false);

        Assert.True(r.Ok);
        var post = t.Context.ForoComunidades.Single();
        Assert.Equal("Encuesta", post.TipoPost);
        Assert.Equal("Encuesta", post.DetallePregunta);
        Assert.False(post.SoloUnaOpcion);
        Assert.Equal(2, post.OpcionesEncuesta.Count);
        Assert.Equal(0, post.OpcionesEncuesta.Min(o => o.Orden));
    }

    // ── Votos ──────────────────────────────────────────────────

    [Fact]
    public async Task Votar_PostInexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).VotarAsync(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Contains("no existe", r.Error!);
    }

    [Fact]
    public async Task Votar_PostQueNoEsEncuesta_Falla()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).VotarAsync(estudiante.EstudianteId, post.PostId, Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Contains("encuesta", r.Error!);
    }

    [Fact]
    public async Task Votar_OpcionDeOtraEncuesta_Falla()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId, "Encuesta", "Encuesta");
        post.OpcionesEncuesta.Add(new EncuestaOpcion { OpcionId = Guid.NewGuid(), PostId = post.PostId, TextoOpcion = "A", Orden = 0 });
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).VotarAsync(estudiante.EstudianteId, post.PostId, Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Contains("opción", r.Error!);
    }

    [Fact]
    public async Task Votar_PrimeraVez_GuardaElVoto()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId, "Encuesta", "Encuesta");
        var opcion = new EncuestaOpcion { OpcionId = Guid.NewGuid(), PostId = post.PostId, TextoOpcion = "A", Orden = 0 };
        post.OpcionesEncuesta.Add(opcion);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).VotarAsync(estudiante.EstudianteId, post.PostId, opcion.OpcionId);

        Assert.True(r.Ok);
        Assert.Equal(opcion.OpcionId, t.Context.EncuestaVotos.Single().OpcionId);
    }

    [Fact]
    public async Task Votar_EncuestaDeUnaSolaOpcion_ReemplazaElVotoAnterior()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId, "Encuesta", "Encuesta");
        var a = new EncuestaOpcion { OpcionId = Guid.NewGuid(), PostId = post.PostId, TextoOpcion = "A", Orden = 0 };
        var b = new EncuestaOpcion { OpcionId = Guid.NewGuid(), PostId = post.PostId, TextoOpcion = "B", Orden = 1 };
        post.OpcionesEncuesta.Add(a);
        post.OpcionesEncuesta.Add(b);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        t.Context.EncuestaVotos.Add(new EncuestaVoto
        {
            VotoId = Guid.NewGuid(),
            PostId = post.PostId,
            OpcionId = a.OpcionId,
            EstudianteId = estudiante.EstudianteId,
        });
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).VotarAsync(estudiante.EstudianteId, post.PostId, b.OpcionId);

        Assert.True(r.Ok);
        var voto = t.Context.EncuestaVotos.Single();
        Assert.Equal(b.OpcionId, voto.OpcionId);
    }

    [Fact]
    public async Task Votar_EncuestaMultiple_AlternaElVotoDeLaOpcion()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId, "Encuesta", "Encuesta");
        post.SoloUnaOpcion = false;
        var a = new EncuestaOpcion { OpcionId = Guid.NewGuid(), PostId = post.PostId, TextoOpcion = "A", Orden = 0 };
        post.OpcionesEncuesta.Add(a);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        t.Context.EncuestaVotos.Add(new EncuestaVoto
        {
            VotoId = Guid.NewGuid(),
            PostId = post.PostId,
            OpcionId = a.OpcionId,
            EstudianteId = estudiante.EstudianteId,
        });
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).VotarAsync(estudiante.EstudianteId, post.PostId, a.OpcionId);

        Assert.True(r.Ok);
        Assert.Empty(t.Context.EncuestaVotos);
    }

    // ── Respuestas ─────────────────────────────────────────────

    [Fact]
    public async Task Responder_Vacia_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ResponderAsync(Guid.NewGuid(), Guid.NewGuid(), "   ");

        Assert.False(r.Ok);
        Assert.Contains("respuesta", r.Error!);
    }

    [Fact]
    public async Task Responder_PostInexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ResponderAsync(Guid.NewGuid(), Guid.NewGuid(), "Hola");

        Assert.False(r.Ok);
        Assert.Contains("no existe", r.Error!);
    }

    [Fact]
    public async Task Responder_DatosValidos_GuardaLaRespuesta()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ResponderAsync(estudiante.EstudianteId, post.PostId, "  Buen aporte  ");

        Assert.True(r.Ok);
        Assert.Equal("Buen aporte", t.Context.RespuestasForo.Single().TextoRespuesta);
    }

    [Fact]
    public async Task Responder_TextoMuyLargo_SeRecortaA4000()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        var post = Post(estudiante.EstudianteId);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        await Crear(t.Context).ResponderAsync(estudiante.EstudianteId, post.PostId, new string('x', 4200));

        Assert.Equal(4000, t.Context.RespuestasForo.Single().TextoRespuesta.Length);
    }

    // ── Borrado ────────────────────────────────────────────────

    [Fact]
    public async Task Eliminar_Inexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).EliminarPostAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Contains("no existe", r.Error!);
    }

    [Fact]
    public async Task Eliminar_PostDeOtroEstudiante_Falla()
    {
        using var t = new TestDb();
        var autor = Datos.Estudiante();
        t.Context.Estudiantes.Add(autor);
        var post = Post(autor.EstudianteId);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).EliminarPostAsync(post.PostId, Guid.NewGuid());

        Assert.False(r.Ok);
        Assert.Single(t.Context.ForoComunidades);
    }

    [Fact]
    public async Task Eliminar_PostPropio_LoBorra()
    {
        using var t = new TestDb();
        var autor = Datos.Estudiante();
        t.Context.Estudiantes.Add(autor);
        var post = Post(autor.EstudianteId);
        t.Context.ForoComunidades.Add(post);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).EliminarPostAsync(post.PostId, autor.EstudianteId);

        Assert.True(r.Ok);
        Assert.Empty(t.Context.ForoComunidades);
    }
}
