using System.ComponentModel.DataAnnotations;

namespace SUGOINOTE2.Models.ViewModels
{
    public class LoginVM
    {
        [Required(ErrorMessage = "El correo es obligatorio")]
        public string CorreoElectronico { get; set; } = null!;

        [Required(ErrorMessage = "La contraseña es obligatoria")]
        public string ClaveAcceso { get; set; } = null!;
    }

    public class RegistroVM
    {
        [Required(ErrorMessage = "El nombre es obligatorio")]
        public string NombreCompleto { get; set; } = null!;

        [Required(ErrorMessage = "El correo es obligatorio")]
        [EmailAddress(ErrorMessage = "Formato de correo no válido")]
        public string CorreoElectronico { get; set; } = null!;

        [Required(ErrorMessage = "La contraseña es obligatoria")]
        public string ClaveAcceso { get; set; } = null!;
    }

    public class RestablecerClaveVM
    {
        public string CorreoElectronico { get; set; } = null!;

        [Required(ErrorMessage = "Ingresa la nueva contraseña")]
        public string NuevaClave { get; set; } = null!;

        [Compare("NuevaClave", ErrorMessage = "Las contraseñas no coinciden")]
        public string ConfirmarClave { get; set; } = null!;
    }
}