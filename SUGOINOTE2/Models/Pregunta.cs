using SUGOINOTE2.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models // <--- Asegúrate que diga SugoiNote
{
    public partial class Pregunta
    {
        [Key]
        public Guid PreguntaId { get; set; }
        public int? ExamenId { get; set; }
        public string TextoPregunta { get; set; } = null!;
        public Guid? RespuestaSeleccionadaId { get; set; }

        // Relación con Examene
        public virtual Examene? Examen { get; set; }

        public virtual ICollection<OpcionesRespuestum> OpcionesRespuesta { get; set; } = new List<OpcionesRespuestum>();
    }
}