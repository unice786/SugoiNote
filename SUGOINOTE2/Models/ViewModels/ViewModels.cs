using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models.ViewModels;

// ── Autenticación ────────────────────────────────────────────

public class LoginVM
{
    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Formato de correo no válido")]
    public string CorreoElectronico { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es obligatoria")]
    public string ClaveAcceso { get; set; } = string.Empty;

    public string? ReturnUrl { get; set; }
}

public class RegistroVM
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [StringLength(150, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 150 caracteres")]
    public string NombreCompleto { get; set; } = string.Empty;

    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Formato de correo no válido")]
    public string CorreoElectronico { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es obligatoria")]
    [StringLength(72, MinimumLength = 8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres")]
    public string ClaveAcceso { get; set; } = string.Empty;

    [Compare(nameof(ClaveAcceso), ErrorMessage = "Las contraseñas no coinciden")]
    public string? ConfirmarClave { get; set; }
}

public class OlvideClaveVM
{
    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Formato de correo no válido")]
    public string CorreoElectronico { get; set; } = string.Empty;
}

public class RestablecerClaveVM
{
    [Required(ErrorMessage = "Introduce tu nueva contraseña")]
    [StringLength(72, MinimumLength = 8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres")]
    public string NuevaClave { get; set; } = string.Empty;

    [Compare(nameof(NuevaClave), ErrorMessage = "Las contraseñas no coinciden")]
    public string? ConfirmarClave { get; set; }
}

// ── Apuntes ──────────────────────────────────────────────────

public class ApunteVM
{
    public Guid ApunteId { get; set; }
    public string TituloNota { get; set; } = string.Empty;
    public Guid? MateriaId { get; set; }
    public string? NombreMateria { get; set; }
    public DateTime? FechaRegistro { get; set; }
    public bool TieneResumen { get; set; }
    public string? ContenidoTexto { get; set; }
    public string? ResumenGeneradoIA { get; set; }
}

public class MateriaVM
{
    public Guid MateriaId { get; set; }
    public string NombreMateria { get; set; } = string.Empty;
}

// ── Exámenes ─────────────────────────────────────────────────

public class ExamenVM
{
    public Guid ExamenId { get; set; }
    public Guid ApunteId { get; set; }
    public string Titulo { get; set; } = string.Empty;

    /// <summary>Alias que usa la vista de la lista de exámenes.</summary>
    public string TituloApunte => Titulo;
    public DateTime? Fecha { get; set; }
    public decimal? Calificacion { get; set; }
    public int Total { get; set; }
}

public class ExamenOpcionVM
{
    public Guid OpcionId { get; set; }
    public string Texto { get; set; } = string.Empty;
    public bool EsCorrecta { get; set; }
    public string? Explicacion { get; set; }
}

public class ExamenPreguntaVM
{
    public Guid PreguntaId { get; set; }
    public string Texto { get; set; } = string.Empty;
    public Guid? RespuestaSeleccionadaId { get; set; }
    public List<ExamenOpcionVM> Opciones { get; set; } = [];
}

public class ExamenDetalleVM
{
    public Guid ExamenId { get; set; }
    public string TituloApunte { get; set; } = string.Empty;
    public DateTime? Fecha { get; set; }
    public decimal? Calificacion { get; set; }
    public int Total { get; set; }
    public int Correctas { get; set; }
    public int Incorrectas { get; set; }
    public List<ExamenPreguntaVM> Preguntas { get; set; } = [];
}

// ── Comunidad ────────────────────────────────────────────────

public class PostVM
{
    public Guid PostId { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Detalle { get; set; } = string.Empty;
    public DateTime? Fecha { get; set; }
    public string TipoPost { get; set; } = "Pregunta";
    public bool EsEncuesta => TipoPost == "Encuesta";
    public string? ImagenUrl { get; set; }
    public Guid? EstudianteId { get; set; }
    public string NombreEstudiante { get; set; } = string.Empty;
    public string? FotoEstudiante { get; set; }
    public int TotalRespuestas { get; set; }
    public int TotalVotos { get; set; }
    public bool SoloUnaOpcion { get; set; } = true;
    public bool YaVoto { get; set; }
    public List<Guid> VotosUsuario { get; set; } = [];
    public List<PostOpcionVM> Opciones { get; set; } = [];
    public int TotalVotosEncuesta => Opciones.Sum(o => o.TotalVotos);
}

public class PostOpcionVM
{
    public Guid OpcionId { get; set; }
    public string Texto { get; set; } = string.Empty;
    public int TotalVotos { get; set; }
}

public class RespuestaVM
{
    public Guid RespuestaId { get; set; }
    public string Texto { get; set; } = string.Empty;
    public DateTime? Fecha { get; set; }
    public Guid? EstudianteId { get; set; }
    public string NombreEstudiante { get; set; } = string.Empty;
    public string? FotoEstudiante { get; set; }
}

public class PostDetalleVM : PostVM
{
    public List<RespuestaVM> Respuestas { get; set; } = [];
}

// ── Perfil ───────────────────────────────────────────────────

public class StatBarVM
{
    public string Etiqueta { get; set; } = string.Empty;
    public int Valor { get; set; }

    /// <summary>Alias que usa el gráfico del perfil.</summary>
    public int Cantidad => Valor;
}

public class PerfilVM
{
    public Guid EstudianteId { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string? FotoPerfil { get; set; }
    public DateTime? FechaCreacion { get; set; }

    public int TotalApuntes { get; set; }
    public int TotalExamenes { get; set; }
    public int TotalResumenes { get; set; }
    public int TotalPublicaciones { get; set; }
    public int TotalMaterias { get; set; }
    public int ApuntesEsteMes { get; set; }
    public int DiasActivos30 { get; set; }
    public double TasaApuntesMes { get; set; }
    public double Promedio { get; set; }

    public List<StatBarVM> ApuntesPorMes { get; set; } = [];
    public List<StatBarVM> ExamenesPorMes { get; set; } = [];
}

// ── Avatar ───────────────────────────────────────────────────

public class AvatarVM
{
    public string Nombre { get; set; } = string.Empty;
    public string? FotoUrl { get; set; }
    public string CssClass { get; set; } = "comunidad-avatar";
}

// ── DTOs de entrada JSON ─────────────────────────────────────

public class AutoSaveDto
{
    public string? ApunteId { get; set; }
    public string? Titulo { get; set; }
    public string? Contenido { get; set; }
}

public class CrearApunteDto
{
    public string? TituloNota { get; set; }
    public Guid? MateriaId { get; set; }
    public string? NuevaMateriaNombre { get; set; }
    public string? ContenidoTexto { get; set; }
}

public class GuardarResumenDto
{
    public string? ApunteId { get; set; }
}

public class GenerarExamenDto
{
    public string? ApunteId { get; set; }
    public string Tipo { get; set; } = "opcion";
    public int CantidadPreguntas { get; set; } = 10;
}

public class CalificarDto
{
    public string? ExamenId { get; set; }
    /// <summary>PreguntaId -> OpcionId elegida.</summary>
    public Dictionary<Guid, Guid> Respuestas { get; set; } = [];
}

public class ChatMensajeDto
{
    public string? Mensaje { get; set; }
    public string? Imagen { get; set; }
}

public class CrearPostDto
{
    public string? Titulo { get; set; }
    public string? Detalle { get; set; }
    public string? ImagenUrl { get; set; }
}

public class CrearEncuestaDto
{
    public string? Titulo { get; set; }

    /// <summary>Enunciado de la pregunta. Se guarda en DetallePregunta.</summary>
    public string? Detalle { get; set; }

    public List<string> Opciones { get; set; } = [];
    public string? ImagenUrl { get; set; }
    public bool SoloUnaOpcion { get; set; } = true;
}

public class VotarDto
{
    public string? PostId { get; set; }
    public List<Guid> OpcionIds { get; set; } = [];
}

public class ResponderDto
{
    public string? PostId { get; set; }
    public string? Texto { get; set; }
}

public class EliminarPostDto
{
    public string? PostId { get; set; }
}

public class ActualizarPerfilDto
{
    public string? NombreCompleto { get; set; }
    public string? Correo { get; set; }
}

public class ActualizarFotoDto
{
    public string? FotoPerfil { get; set; }
}