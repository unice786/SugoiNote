using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

/// <summary>
/// Token de un solo uso para restablecer la contraseña.
/// Se almacena <b>solo el hash SHA-256</b>: el valor en claro viaja únicamente en el email.
/// </summary>
public class PasswordResetToken
{
    public Guid TokenId { get; set; } = Guid.NewGuid();

    [Required]
    public Guid EstudianteId { get; set; }

    /// <summary>Hash SHA-256 en base64 del token en claro.</summary>
    [Required, MaxLength(64)]
    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreadoUtc { get; set; } = DateTime.UtcNow;

    public DateTime ExpiraUtc { get; set; }

    public DateTime? UsadoUtc { get; set; }

    public bool EsValido => UsadoUtc is null && ExpiraUtc > DateTime.UtcNow;

    public virtual Estudiante? Estudiante { get; set; }
}