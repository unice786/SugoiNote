namespace SugoiNote.Models;

public class ErrorViewModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);

    /// <summary>Código HTTP: 404, 403, 429…</summary>
    public int Codigo { get; set; }

    /// <summary>Texto apto para mostrar al usuario. Nunca contiene detalles internos.</summary>
    public string? Mensaje { get; set; }
}