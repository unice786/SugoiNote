using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public partial class OpcionRespuesta
{
    public Guid OpcionId { get; set; }

    public Guid? PreguntaId { get; set; }

    [Required]
    public string TextoOpcion { get; set; } = string.Empty;

    public bool EsLaCorrecta { get; set; }

    public string? ExplicacionIA { get; set; }

    public virtual Pregunta? Pregunta { get; set; }
}