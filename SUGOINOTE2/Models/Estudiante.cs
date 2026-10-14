using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public partial class Estudiante
{
    public Guid EstudianteId { get; set; }

    [Required, MaxLength(150)]
    public string NombreCompleto { get; set; } = string.Empty;

    [Required, MaxLength(150), EmailAddress]
    public string CorreoElectronico { get; set; } = string.Empty;

    /// <summary>Hash bcrypt. Nunca texto plano.</summary>
    [Required, MaxLength(255)]
    public string ClaveAcceso { get; set; } = string.Empty;

    public DateTime? FechaCreacion { get; set; }

    public string? FotoPerfil { get; set; }

    // ── Seguridad (F1) ─────────────────────────────────────────
    public int FailedLoginCount { get; set; }

    public DateTime? LockoutEndUtc { get; set; }

    /// <summary>
    /// Se invalida al cambiar contraseña o correo, y fuerza la re-emisión del cookie de sesión.
    /// </summary>
    [MaxLength(64)]
    public string? SecurityStamp { get; set; }

    // ── Navegaciones ───────────────────────────────────────────
    public virtual ICollection<Apunte> Apuntes { get; set; } = new List<Apunte>();
    public virtual ICollection<Materia> Materias { get; set; } = new List<Materia>();
    public virtual ICollection<ForoComunidad> ForoComunidades { get; set; } = new List<ForoComunidad>();
    public virtual ICollection<RespuestaForo> RespuestasForo { get; set; } = new List<RespuestaForo>();
    public virtual ICollection<EncuestaVoto> EncuestaVotos { get; set; } = new List<EncuestaVoto>();
}