using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public class Examene
{
    public Guid ExamenId { get; set; }

    public Guid? ApunteId { get; set; }
    public decimal? CalificacionFinal { get; set; }
    public DateTime? FechaRealizacion { get; set; }

    public virtual Apunte? Apunte { get; set; }
    public virtual ICollection<Pregunta> Preguntas { get; set; } = new List<Pregunta>();
}