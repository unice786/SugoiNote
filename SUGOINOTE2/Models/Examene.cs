using SUGOINOTE2.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models
{
    public class Examene
    {
        [Key]
        public int ExamenId { get; set; }
        public decimal? CalificacionFinal { get; set; }
        public DateTime FechaRealizacion { get; set; }

        // Relación con Apunte
        public int? ApunteId { get; set; }
        public virtual Apunte? Apunte { get; set; }

        // Relación con Preguntas
        public virtual ICollection<Pregunta> Preguntas { get; set; } = new List<Pregunta>();
    }
}