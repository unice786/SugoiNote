using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public partial class Pregunta
{
    public Guid PreguntaId { get; set; }

    public Guid? ExamenId { get; set; }

    [Required]
    public string TextoPregunta { get; set; } = string.Empty;

    public Guid? RespuestaSeleccionadaId { get; set; }

    public virtual Examene? Examen { get; set; }
    public virtual ICollection<OpcionRespuesta> Opciones { get; set; } = new List<OpcionRespuesta>();
}