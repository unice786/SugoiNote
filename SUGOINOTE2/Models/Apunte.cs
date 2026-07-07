using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models
{
    public partial class Apunte
    {
        public Guid ApunteId { get; set; }
        [Required]
        public string TituloNota { get; set; } = string.Empty;
        public string? ContenidoTexto { get; set; }
        public string? ResumenGeneradoIA { get; set; }
        public Guid? MateriaId { get; set; }
        public Guid EstudianteId { get; set; }
        public DateTime? FechaRegistro { get; set; }
        public string? newMateriaName { get; set; } // Para crear materias al vuelo
    }
}