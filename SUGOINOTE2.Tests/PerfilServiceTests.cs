using Microsoft.Extensions.Logging.Abstractions;
using SugoiNote.Models;
using SugoiNote.Services.Common;
using SugoiNote.Services.Perfiles;

namespace SUGOINOTE2.Tests;

/// <summary>
/// Pruebas del perfil del estudiante: las cifras que muestra la pantalla de perfil
/// (apuntes, resumenes, promedio, dias activos) y la validacion de los cambios de
/// nombre, correo y foto.
/// </summary>
public class PerfilServiceTests
{
    private static PerfilService Crear(Sugoinotee2Context db, LimitesOptions? limites = null) =>
        new(db, new SugoiHtmlSanitizer(), Datos.Opciones(limites ?? new LimitesOptions()), NullLogger<PerfilService>.Instance);

    [Fact]
    public async Task Obtener_EstudianteInexistente_DevuelveNull()
    {
        using var t = new TestDb();

        Assert.Null(await Crear(t.Context).ObtenerAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Obtener_CalculaLasCifrasDelPerfil()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);

        var conResumen = new Apunte
        {
            ApunteId = Guid.NewGuid(),
            TituloNota = "Con resumen",
            ContenidoTexto = "<p>texto</p>",
            ResumenGeneradoIA = "<p>resumen</p>",
            EstudianteId = estudiante.EstudianteId,
            FechaRegistro = DateTime.UtcNow,
        };
        var sinResumen = new Apunte
        {
            ApunteId = Guid.NewGuid(),
            TituloNota = "Sin resumen",
            ContenidoTexto = "<p>texto</p>",
            EstudianteId = estudiante.EstudianteId,
            FechaRegistro = DateTime.UtcNow.AddMonths(-1),
        };
        t.Context.Apuntes.AddRange(conResumen, sinResumen);

        t.Context.Examenes.AddRange(
            new Examene { ExamenId = Guid.NewGuid(), ApunteId = conResumen.ApunteId, CalificacionFinal = 80 },
            new Examene { ExamenId = Guid.NewGuid(), ApunteId = sinResumen.ApunteId, CalificacionFinal = 40 },
            new Examene { ExamenId = Guid.NewGuid(), ApunteId = conResumen.ApunteId, CalificacionFinal = null });

        t.Context.Materias.Add(new Materia
        {
            MateriaId = Guid.NewGuid(),
            NombreMateria = "Matematica",
            EstudianteId = estudiante.EstudianteId,
        });

        t.Context.ForoComunidades.Add(new ForoComunidad
        {
            PostId = Guid.NewGuid(),
            TituloPregunta = "Duda",
            DetallePregunta = "Detalle",
            TipoPost = "Pregunta",
            EstudianteId = estudiante.EstudianteId,
            FechaPublicacion = DateTime.UtcNow,
        });

        await t.Context.SaveChangesAsync();

        var perfil = await Crear(t.Context).ObtenerAsync(estudiante.EstudianteId);

        Assert.NotNull(perfil);
        Assert.Equal(2, perfil!.TotalApuntes);
        Assert.Equal(1, perfil.TotalResumenes);
        Assert.Equal(1, perfil.TotalPublicaciones);
        Assert.Equal(1, perfil.TotalMaterias);
        Assert.Equal(3, perfil.TotalExamenes);
        Assert.Equal(1, perfil.ExamenesAprobados);
        Assert.Equal(60, perfil.Promedio);
        Assert.Equal(1, perfil.ApuntesEsteMes);
        Assert.Equal(2, perfil.DiasConApuntes);
        Assert.Equal(6, perfil.ApuntesPorMes.Count);
    }

    [Fact]
    public async Task Obtener_SinFechaDeCreacion_DejaUnDiaActivo()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        estudiante.FechaCreacion = null;
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var perfil = await Crear(t.Context).ObtenerAsync(estudiante.EstudianteId);

        Assert.Equal(1, perfil!.DiasActivo);
    }

    [Fact]
    public async Task Obtener_SinExamenesCalificados_PromedioCero()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var perfil = await Crear(t.Context).ObtenerAsync(estudiante.EstudianteId);

        Assert.Equal(0, perfil!.Promedio);
        Assert.Equal(0, perfil.TotalApuntes);
        Assert.All(perfil.ApuntesPorMes, m => Assert.Equal(0, m.Valor));
    }

    [Fact]
    public async Task Obtener_DescartaLaFotoConEsquemaPeligroso()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        estudiante.FotoPerfil = "javascript:alert(1)";
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var perfil = await Crear(t.Context).ObtenerAsync(estudiante.EstudianteId);

        Assert.Null(perfil!.FotoPerfil);
    }

    [Theory]
    [InlineData("A")]
    [InlineData("")]
    public async Task Actualizar_NombreInvalido_Falla(string nombre)
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(estudiante.EstudianteId, nombre, "ana@correo.com");

        Assert.False(r.Ok);
        Assert.Contains("nombre", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Actualizar_NombreDemasiadoLargo_Falla()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(estudiante.EstudianteId, new string('a', 151), "ana@correo.com");

        Assert.False(r.Ok);
    }

    [Theory]
    [InlineData("sinarroba.com")]
    [InlineData("dos@arrobas@correo.com")]
    [InlineData("ana@sinpunto")]
    [InlineData("ana@correo.")]
    [InlineData("ana @correo.com")]
    [InlineData("ana@.com")]
    public async Task Actualizar_CorreoInvalido_Falla(string correo)
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(estudiante.EstudianteId, "Ana Perez", correo);

        Assert.False(r.Ok);
        Assert.Contains("correo", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Actualizar_EstudianteInexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ActualizarAsync(Guid.NewGuid(), "Ana Perez", "ana@correo.com");

        Assert.False(r.Ok);
        Assert.Contains("cuenta", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Actualizar_CorreoOcupado_Falla()
    {
        using var t = new TestDb();
        var uno = Datos.Estudiante(nombre: "Uno", correo: "uno@correo.com");
        var dos = Datos.Estudiante(nombre: "Dos", correo: "dos@correo.com");
        t.Context.Estudiantes.AddRange(uno, dos);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(uno.EstudianteId, "Uno", "dos@correo.com");

        Assert.False(r.Ok);
        Assert.Contains("registrado", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Actualizar_DatosValidos_GuardaYRenuevaElSello()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        var selloOriginal = estudiante.SecurityStamp;
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(estudiante.EstudianteId, "  Ana Maria  ", "  Nueva@Correo.COM ");

        Assert.True(r.Ok);
        var guardado = t.Context.Estudiantes.Single();
        Assert.Equal("Ana Maria", guardado.NombreCompleto);
        Assert.Equal("nueva@correo.com", guardado.CorreoElectronico);
        Assert.NotEqual(selloOriginal, guardado.SecurityStamp);
    }

    [Fact]
    public async Task Actualizar_MismoCorreo_NoRenuevaElSello()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        var selloOriginal = estudiante.SecurityStamp;
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var r = await Crear(t.Context).ActualizarAsync(estudiante.EstudianteId, "Ana Perez", estudiante.CorreoElectronico);

        Assert.True(r.Ok);
        Assert.Equal(selloOriginal, t.Context.Estudiantes.Single().SecurityStamp);
    }

    [Fact]
    public async Task ActualizarFoto_Vacia_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ActualizarFotoAsync(Guid.NewGuid(), "   ");

        Assert.False(r.Ok);
        Assert.Contains("imagen", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ActualizarFoto_DemasiadoGrande_Falla()
    {
        using var t = new TestDb();
        var limites = new LimitesOptions { MaxBytesImagen = 16 };

        var r = await Crear(t.Context, limites).ActualizarFotoAsync(Guid.NewGuid(), "data:image/png;base64," + new string('A', 1500));

        Assert.False(r.Ok);
        Assert.Contains("MB", r.Error!);
    }

    [Fact]
    public async Task ActualizarFoto_FormatoInvalido_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ActualizarFotoAsync(Guid.NewGuid(), "data:image/svg+xml;base64,PHN2Zz4=");

        Assert.False(r.Ok);
        Assert.Contains("Formato", r.Error!);
    }

    [Fact]
    public async Task ActualizarFoto_EstudianteInexistente_Falla()
    {
        using var t = new TestDb();

        var r = await Crear(t.Context).ActualizarFotoAsync(Guid.NewGuid(), "data:image/png;base64,iVBORw0KGgo=");

        Assert.False(r.Ok);
        Assert.Contains("cuenta", r.Error!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ActualizarFoto_DatosValidos_GuardaLaImagen()
    {
        using var t = new TestDb();
        var estudiante = Datos.Estudiante();
        t.Context.Estudiantes.Add(estudiante);
        await t.Context.SaveChangesAsync();

        var dataUri = "data:image/png;base64,iVBORw0KGgo=";
        var r = await Crear(t.Context).ActualizarFotoAsync(estudiante.EstudianteId, dataUri);

        Assert.True(r.Ok);
        Assert.Equal(dataUri, t.Context.Estudiantes.Single().FotoPerfil);
    }
}
