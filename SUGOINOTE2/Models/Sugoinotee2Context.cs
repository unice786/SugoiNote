using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;

namespace SugoiNote.Models
{
    public partial class Sugoinotee2Context : DbContext
    {
        public Sugoinotee2Context() { }

        public Sugoinotee2Context(DbContextOptions<Sugoinotee2Context> options) : base(options) { }

        public virtual DbSet<Apunte> Apuntes { get; set; }
        public virtual DbSet<Estudiante> Estudiantes { get; set; }
        public virtual DbSet<Examene> Examenes { get; set; }
        public virtual DbSet<ForoComunidad> ForoComunidads { get; set; }
        public virtual DbSet<Materia> Materias { get; set; }
        public virtual DbSet<OpcionesRespuestum> OpcionesRespuesta { get; set; }
        public virtual DbSet<Pregunta> Preguntas { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            // vacío — usa la conexión de appsettings.json via Program.cs
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ForoComunidad>(entity =>
            {
                entity.HasKey(e => e.PostId);
                entity.ToTable("ForoComunidad");
            });

            modelBuilder.Entity<Materia>(entity =>
            {
                entity.ToTable("Materias");
                entity.HasKey(e => e.MateriaId);
                entity.Property(e => e.MateriaId)
                      .HasColumnName("MaterialID");
                entity.Property(e => e.NombreMateria)
                      .HasColumnName("NombreMateria")
                      .HasMaxLength(100);
                entity.Property(e => e.EstudianteId)
                      .HasColumnName("EstudianteID");
            });

            modelBuilder.Entity<Apunte>(entity =>
            {
                entity.ToTable("Apuntes");
                entity.HasKey(e => e.ApunteId);
                entity.Property(e => e.ApunteId)
                      .HasColumnName("ApunteID");
                entity.Property(e => e.TituloNota)
                      .HasColumnName("TituloNota")
                      .HasMaxLength(200);
                entity.Property(e => e.ContenidoTexto)
                      .HasColumnName("ContenidoTexto");
                entity.Property(e => e.ResumenGeneradoIA)
                      .HasColumnName("ResumenGeneradoIA");
                entity.Property(e => e.MateriaId)
                      .HasColumnName("MaterialID");
                entity.Property(e => e.EstudianteId)
                      .HasColumnName("EstudianteID");
                entity.Property(e => e.FechaRegistro)
                      .HasColumnName("FechaRegistro");
            });
        }
    }
}