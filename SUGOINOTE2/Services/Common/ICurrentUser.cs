using System.Security.Claims;

namespace SugoiNote.Services.Common;

public interface ICurrentUser
{
    /// <summary>Id del estudiante autenticado, o <c>null</c> si no hay sesión.</summary>
    Guid? Id { get; }

    /// <summary>Id del estudiante autenticado. Lanza si se usa fuera de una petición autorizada.</summary>
    Guid RequireId();

    string? Nombre { get; }

    bool EstaAutenticado { get; }
}

/// <summary>
/// Única fuente de verdad para el usuario actual. Elimina los ~12
/// <c>User.FindFirst(...)!.Value</c> dispersos por los controladores.
/// </summary>
public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool EstaAutenticado => Principal?.Identity?.IsAuthenticated == true;

    public Guid? Id
    {
        get
        {
            var raw = Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public Guid RequireId() => Id ?? throw new UnauthorizedAccessException("No hay un estudiante autenticado en el contexto.");

    public string? Nombre => Principal?.FindFirst(ClaimTypes.Name)?.Value;
}