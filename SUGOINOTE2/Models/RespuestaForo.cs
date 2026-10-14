using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public class RespuestaForo
{
    public Guid RespuestaId { get; set; }

    public Guid? PostId { get; set; }
    public Guid? EstudianteId { get; set; }

    [Required]
    public string TextoRespuesta { get; set; } = string.Empty;

    public DateTime? FechaRespuesta { get; set; }

    public virtual ForoComunidad? Post { get; set; }
    public virtual Estudiante? Estudiante { get; set; }
}