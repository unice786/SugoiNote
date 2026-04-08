using System;
using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models // <--- Asegúrate que diga SugoiNote
{
    public partial class OpcionesRespuestum
    {
        [Key]
        public Guid OpcionId { get; set; }
        public Guid? PreguntaId { get; set; }
        public string TextoOpcion { get; set; } = null!;
        public bool EsLaCorrecta { get; set; }
        public string? ExplicacionIa { get; set; }

        // Relación con Pregunta
        public virtual Pregunta? Pregunta { get; set; }
    }
}