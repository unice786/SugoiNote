using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public class ForoComunidad
{
    public Guid PostId { get; set; }

    [Required, MaxLength(200)]
    public string TituloPregunta { get; set; } = string.Empty;

    /// <summary>Cuerpo del post. En la BD: <c>DetallePregunta</c>.</summary>
    [Required]
    public string DetallePregunta { get; set; } = string.Empty;

    /// <summary>Campo heredado del esquema original. La app usa <see cref="RespuestaForo"/>.</summary>
    public string? RespuestaTexto { get; set; }

    public DateTime? FechaPublicacion { get; set; }

    /// <summary>"Pregunta" | "Encuesta". Longitud máxima 20 (columna nvarchar(20)).</summary>
    [Required, MaxLength(20)]
    public string TipoPost { get; set; } = "Pregunta";

    /// <summary>Data-URI de la imagen del post. Sanea siempre con <c>sanitizeUrl</c>.</summary>
    public string? ImagenUrl { get; set; }

    public bool SoloUnaOpcion { get; set; } = true;

    public Guid? EstudianteId { get; set; }

    public virtual Estudiante? Estudiante { get; set; }
    public virtual ICollection<RespuestaForo> Respuestas { get; set; } = new List<RespuestaForo>();
    public virtual ICollection<EncuestaOpcion> OpcionesEncuesta { get; set; } = new List<EncuestaOpcion>();
}