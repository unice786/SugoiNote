using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public class EncuestaVoto
{
    public Guid VotoId { get; set; }

    public Guid PostId { get; set; }
    public Guid OpcionId { get; set; }
    public Guid EstudianteId { get; set; }
    public DateTime FechaVoto { get; set; } = DateTime.UtcNow;

    public virtual EncuestaOpcion? Opcion { get; set; }
    public virtual Estudiante? Estudiante { get; set; }
}