using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;

namespace SugoiNote.Models;

public partial class Sugoinotee2Context(DbContextOptions<Sugoinotee2Context> options) : DbContext(options), IDataProtectionKeyContext
{

    public DbSet<Apunte> Apuntes => Set<Apunte>();
    public DbSet<Estudiante> Estudiantes => Set<Estudiante>();
    public DbSet<Examene> Examenes => Set<Examene>();
    public DbSet<ForoComunidad> ForoComunidades => Set<ForoComunidad>();
    public DbSet<Materia> Materias => Set<Materia>();
    public DbSet<OpcionRespuesta> OpcionesRespuesta => Set<OpcionRespuesta>();
    public DbSet<Pregunta> Preguntas => Set<Pregunta>();
    public DbSet<RespuestaForo> RespuestasForo => Set<RespuestaForo>();
    public DbSet<EncuestaOpcion> EncuestaOpciones => Set<EncuestaOpcion>();
    public DbSet<EncuestaVoto> EncuestaVotos => Set<EncuestaVoto>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    // Tipo del paquete Microsoft.AspNetCore.DataProtection.EntityFrameworkCore:
    // la interfaz IDataProtectionKeyContext exige exactamente este DbSet<T>.
    public DbSet<Microsoft.AspNetCore.DataProtection.EntityFrameworkCore.DataProtectionKey> DataProtectionKeys { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ── Estudiante ───────────────────────────────────────────
        b.Entity<Estudiante>(e =>
        {
            e.ToTable("Estudiantes");
            e.HasKey(x => x.EstudianteId);
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.Property(x => x.NombreCompleto).HasColumnName("NombreCompleto").HasMaxLength(150).IsRequired();
            e.Property(x => x.CorreoElectronico).HasColumnName("CorreoElectronico").HasMaxLength(150).IsRequired();
            e.Property(x => x.ClaveAcceso).HasColumnName("ClaveAcceso").HasMaxLength(255).IsRequired();
            e.Property(x => x.FechaCreacion).HasColumnName("FechaCreacion");
            e.Property(x => x.FotoPerfil).HasColumnName("FotoPerfil");
            e.Property(x => x.FailedLoginCount).HasColumnName("FailedLoginCount").HasDefaultValue(0);
            e.Property(x => x.LockoutEndUtc).HasColumnName("LockoutEndUtc");
            e.Property(x => x.SecurityStamp).HasColumnName("SecurityStamp").HasMaxLength(64);
            e.HasIndex(x => x.CorreoElectronico).IsUnique().HasDatabaseName("UQ__Estudian__531402F34F775A62");
        });

        // ── Materia ──────────────────────────────────────────────
        b.Entity<Materia>(e =>
        {
            e.ToTable("Materias");
            e.HasKey(x => x.MateriaId);
            // El esquema real es MateriaID. Antes el Fluent mapaba "MaterialID" y el SQL usaba "MateriaID":
            // una de las dos estaba mal y provocaba "MateriaID" no existe.
            e.Property(x => x.MateriaId).HasColumnName("MateriaID");
            e.Property(x => x.NombreMateria).HasColumnName("NombreMateria").HasMaxLength(100).IsRequired();
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.HasOne(x => x.Estudiante).WithMany(x => x.Materias)
             .HasForeignKey(x => x.EstudianteId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Apunte ───────────────────────────────────────────────
        b.Entity<Apunte>(e =>
        {
            e.ToTable("Apuntes");
            e.HasKey(x => x.ApunteId);
            e.Property(x => x.ApunteId).HasColumnName("ApunteID");
            e.Property(x => x.TituloNota).HasColumnName("TituloNota").HasMaxLength(200).IsRequired();
            e.Property(x => x.ContenidoTexto).HasColumnName("ContenidoTexto");
            e.Property(x => x.ResumenGeneradoIA).HasColumnName("ResumenGeneradoIA");
            e.Property(x => x.MateriaId).HasColumnName("MateriaID");
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.Property(x => x.FechaRegistro).HasColumnName("FechaRegistro").HasDefaultValueSql("getdate()");

            e.HasOne(x => x.Materia).WithMany(x => x.Apuntes)
             .HasForeignKey(x => x.MateriaId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Estudiante).WithMany(x => x.Apuntes)
             .HasForeignKey(x => x.EstudianteId).OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.EstudianteId);
        });

        // ── Examenes ─────────────────────────────────────────────
        b.Entity<Examene>(e =>
        {
            e.ToTable("Examenes");
            e.HasKey(x => x.ExamenId);
            // El esquema real es UNIQUEIDENTIFIER. El modelo decía int.
            e.Property(x => x.ExamenId).HasColumnName("ExamenID");
            e.Property(x => x.ApunteId).HasColumnName("ApunteID");
            e.Property(x => x.CalificacionFinal).HasColumnName("CalificacionFinal").HasPrecision(5, 2);
            e.Property(x => x.FechaRealizacion).HasColumnName("FechaRealizacion").HasDefaultValueSql("getdate()");

            e.HasOne(x => x.Apunte).WithMany(x => x.Examenes)
             .HasForeignKey(x => x.ApunteId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── Preguntas ────────────────────────────────────────────
        b.Entity<Pregunta>(e =>
        {
            e.ToTable("Preguntas");
            e.HasKey(x => x.PreguntaId);
            e.Property(x => x.PreguntaId).HasColumnName("PreguntaID");
            e.Property(x => x.ExamenId).HasColumnName("ExamenID");
            e.Property(x => x.TextoPregunta).HasColumnName("TextoPregunta").IsRequired();
            e.Property(x => x.RespuestaSeleccionadaId).HasColumnName("RespuestaSeleccionadaID");

            // La columna no tiene FK en la BD (guarda el OpcionID elegido). Se deja como dato plano
            // a proposito: el servicio de calificacion valida pertenencia antes de escribir.
            e.HasOne(x => x.Examen).WithMany(x => x.Preguntas)
             .HasForeignKey(x => x.ExamenId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── OpcionesRespuesta ────────────────────────────────────
        b.Entity<OpcionRespuesta>(e =>
        {
            e.ToTable("OpcionesRespuesta");
            e.HasKey(x => x.OpcionId);
            e.Property(x => x.OpcionId).HasColumnName("OpcionID");
            e.Property(x => x.PreguntaId).HasColumnName("PreguntaID");
            e.Property(x => x.TextoOpcion).HasColumnName("TextoOpcion").IsRequired();
            e.Property(x => x.EsLaCorrecta).HasColumnName("EsLaCorrecta");
            e.Property(x => x.ExplicacionIA).HasColumnName("ExplicacionIA");

            e.HasOne(x => x.Pregunta).WithMany(x => x.Opciones)
             .HasForeignKey(x => x.PreguntaId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── ForoComunidad ────────────────────────────────────────
        b.Entity<ForoComunidad>(e =>
        {
            e.ToTable("ForoComunidad");
            e.HasKey(x => x.PostId);
            e.Property(x => x.PostId).HasColumnName("PostID");
            e.Property(x => x.TituloPregunta).HasColumnName("TituloPregunta").HasMaxLength(200).IsRequired();
            // La columna real es DetallePregunta. El modelo decía "Contenido" (propiedad inexistente).
            e.Property(x => x.DetallePregunta).HasColumnName("DetallePregunta").IsRequired();
            e.Property(x => x.RespuestaTexto).HasColumnName("RespuestaTexto");
            e.Property(x => x.FechaPublicacion).HasColumnName("FechaPublicacion").HasDefaultValueSql("getdate()");
            e.Property(x => x.TipoPost).HasColumnName("TipoPost").HasMaxLength(20).IsRequired().HasDefaultValue("Pregunta");
            e.Property(x => x.ImagenUrl).HasColumnName("ImagenUrl");
            e.Property(x => x.SoloUnaOpcion).HasColumnName("SoloUnaOpcion").HasDefaultValue(true);

            e.HasOne(x => x.Estudiante).WithMany(x => x.ForoComunidades)
             .HasForeignKey(x => x.EstudianteId).OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(x => x.FechaPublicacion);
        });

        // ── RespuestasForo ───────────────────────────────────────
        b.Entity<RespuestaForo>(e =>
        {
            e.ToTable("RespuestasForo");
            e.HasKey(x => x.RespuestaId);
            e.Property(x => x.RespuestaId).HasColumnName("RespuestaID");
            e.Property(x => x.PostId).HasColumnName("PostID");
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.Property(x => x.TextoRespuesta).HasColumnName("TextoRespuesta").IsRequired();
            e.Property(x => x.FechaRespuesta).HasColumnName("FechaRespuesta").HasDefaultValueSql("getdate()");

            e.HasOne(x => x.Post).WithMany(x => x.Respuestas)
             .HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Estudiante).WithMany(x => x.RespuestasForo)
             .HasForeignKey(x => x.EstudianteId).OnDelete(DeleteBehavior.SetNull);
        });

        // ── EncuestaOpciones ─────────────────────────────────────
        b.Entity<EncuestaOpcion>(e =>
        {
            e.ToTable("EncuestaOpciones");
            e.HasKey(x => x.OpcionId);
            e.Property(x => x.OpcionId).HasColumnName("OpcionID");
            e.Property(x => x.PostId).HasColumnName("PostID");
            e.Property(x => x.TextoOpcion).HasColumnName("TextoOpcion").HasMaxLength(250).IsRequired();
            e.Property(x => x.Orden).HasColumnName("Orden");

            e.HasOne(x => x.Post).WithMany(x => x.OpcionesEncuesta)
             .HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── EncuestaVotos ────────────────────────────────────────
        b.Entity<EncuestaVoto>(e =>
        {
            e.ToTable("EncuestaVotos");
            e.HasKey(x => x.VotoId);
            e.Property(x => x.VotoId).HasColumnName("VotoID");
            e.Property(x => x.PostId).HasColumnName("PostID");
            e.Property(x => x.OpcionId).HasColumnName("OpcionID");
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.Property(x => x.FechaVoto).HasColumnName("FechaVoto").HasDefaultValueSql("getdate()");

            e.HasOne(x => x.Opcion).WithMany(x => x.Votos)
             .HasForeignKey(x => x.OpcionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.PostId, x.EstudianteId, x.OpcionId }).IsUnique()
             .HasDatabaseName("UQ_EncuestaVoto_Opcion");
        });

        // ── PasswordResetToken ───────────────────────────────────
        b.Entity<PasswordResetToken>(e =>
        {
            e.ToTable("PasswordResetTokens");
            e.HasKey(x => x.TokenId);
            e.Property(x => x.TokenId).HasColumnName("TokenID");
            e.Property(x => x.EstudianteId).HasColumnName("EstudianteID");
            e.Property(x => x.TokenHash).HasColumnName("TokenHash").HasMaxLength(64).IsRequired();
            e.Property(x => x.CreadoUtc).HasColumnName("CreadoUtc");
            e.Property(x => x.ExpiraUtc).HasColumnName("ExpiraUtc");
            e.Property(x => x.UsadoUtc).HasColumnName("UsadoUtc");

            e.HasOne(x => x.Estudiante).WithMany()
             .HasForeignKey(x => x.EstudianteId).OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.TokenHash);
        });
    }
}