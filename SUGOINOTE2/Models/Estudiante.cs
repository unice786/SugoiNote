using SUGOINOTE2.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models
{
    public class Estudiante
    {
        [Key]
        public Guid EstudianteId { get; set; }

        public string NombreCompleto { get; set; } = null!;
        public string CorreoElectronico { get; set; } = null!;
        public string ClaveAcceso { get; set; } = null!;
        public DateTime FechaCreacion { get; set; }

        // Relaciones - Asegúrate de que los nombres coincidan con tus otros archivos
        public virtual ICollection<Apunte> Apuntes { get; set; } = new List<Apunte>();
        public virtual ICollection<Materia> Materia { get; set; } = new List<Materia>();
        public virtual ICollection<ForoComunidad> ForoComunidads { get; set; } = new List<ForoComunidad>();
    }
}