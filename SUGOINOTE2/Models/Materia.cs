namespace SugoiNote.Models
{
    public partial class Materia
    {
        public Guid MateriaId { get; set; }  // ← debe llamarse exactamente así

        public string NombreMateria { get; set; } = string.Empty;

        public Guid EstudianteId { get; set; }
    }
}