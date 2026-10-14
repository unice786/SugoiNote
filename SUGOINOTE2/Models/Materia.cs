using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public partial class Materia
{
    public Guid MateriaId { get; set; }

    [Required, MaxLength(100)]
    public string NombreMateria { get; set; } = string.Empty;

    public Guid? EstudianteId { get; set; }

    public virtual Estudiante? Estudiante { get; set; }
    public virtual ICollection<Apunte> Apuntes { get; set; } = new List<Apunte>();
}