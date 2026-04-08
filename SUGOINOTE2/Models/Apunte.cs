using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SugoiNote.Models
{
    public partial class Apunte
    {
        public Guid ApunteId { get; set; }

        [Required]
        [MaxLength(200)]
        public string TituloNota { get; set; } = string.Empty;

        public string? ContenidoTexto { get; set; }

        public string? ResumenGeneradoIA { get; set; }

        public Guid? MateriaId { get; set; }  // ← debe llamarse exactamente así

        public Guid EstudianteId { get; set; }

        public DateTime? FechaRegistro { get; set; }

        public string? newMateriaName { get; set; }
        
    }
}