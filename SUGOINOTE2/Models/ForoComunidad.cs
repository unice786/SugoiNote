using SUGOINOTE2.Models;
using System;
using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models
{
    public class ForoComunidad
    {
        [Key]
        public int PostId { get; set; }
        public string? TituloPregunta { get; set; }
        public string? Contenido { get; set; }
        public DateTime FechaPublicacion { get; set; }
        public Guid? EstudianteId { get; set; }
        public virtual Estudiante? Estudiante { get; set; }
    }
}