using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public partial class Apunte
{
    public Guid ApunteId { get; set; }

    [Required, MaxLength(200)]
    public string TituloNota { get; set; } = string.Empty;

    /// <summary>HTML sanitizado por <c>IHtmlSanitizer</c> antes de persistir.</summary>
    public string? ContenidoTexto { get; set; }

    /// <summary>HTML generado por IA y sanitizado. Nunca debe contener texto de error.</summary>
    public string? ResumenGeneradoIA { get; set; }

    public Guid? MateriaId { get; set; }
    public Guid? EstudianteId { get; set; }
    public DateTime? FechaRegistro { get; set; }

    public virtual Materia? Materia { get; set; }
    public virtual Estudiante? Estudiante { get; set; }
    public virtual ICollection<Examene> Examenes { get; set; } = new List<Examene>();

    /// <summary>No se mapea a la BD: solo existe para crear la materia al vuelo desde el formulario.</summary>
    [NotMapped]
    public string? NuevaMateriaNombre { get; set; }
}