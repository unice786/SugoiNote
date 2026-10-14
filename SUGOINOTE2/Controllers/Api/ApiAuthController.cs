using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Models;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers.Api;

/// <summary>
/// Autenticacion para la app movil.
/// Devuelve un token JWT en vez de una cookie, porque React Native no comparte el
/// almacen de cookies del navegador.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class ApiAuthController(
    IAuthService auth,
    IJwtTokenService tokens,
    ICurrentUser usuario) : ControllerBase
{
    /// <summary>Alta de estudiante. Devuelve el token para no obligar a iniciar sesion.</summary>
    [HttpPost("registrar")]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("Login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Registrar([FromBody] RegistroRequest dto, CancellationToken ct)
    {
        var resultado = await auth.RegistrarAsync(dto.NombreCompleto, dto.CorreoElectronico, dto.ClaveAcceso, ct);

        if (!resultado.Exito)
            return BadRequest(new ApiError(resultado.Error ?? "No se pudo completar el registro."));

        // RegistrarAsync no devuelve la entidad, asi que se recupera con las mismas
        // credenciales para poder emitir el token en la misma llamada.
        var (_, estudiante) = await auth.ValidarCredencialesAsync(dto.CorreoElectronico, dto.ClaveAcceso, ct);
        if (estudiante is null)
            return BadRequest(new ApiError("Cuenta creada, pero no se pudo iniciar sesión. Intenta iniciar sesión."));

        return Ok(new AuthResponse(tokens.Crear(estudiante), EstudianteDto.Desde(estudiante)));
    }

    /// <summary>Inicio de sesion. Devuelve el token JWT que se envia en cada peticion.</summary>
    [HttpPost("login")]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("Login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiError), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Login([FromBody] LoginRequest dto, CancellationToken ct)
    {
        var (resultado, estudiante) = await auth.ValidarCredencialesAsync(dto.CorreoElectronico, dto.ClaveAcceso, ct);

        if (!resultado.Exito || estudiante is null)
            return BadRequest(new ApiError(resultado.Error ?? "Credenciales incorrectas."));

        return Ok(new AuthResponse(tokens.Crear(estudiante), EstudianteDto.Desde(estudiante)));
    }

    /// <summary>Comprueba el token y devuelve su identificador de estudiante.</summary>
    /// <remarks>El movil lo llama al abrir la app para decidir si la sesion sigue viva.</remarks>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(SesionActual), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Me() => Ok(new SesionActual(usuario.RequireId()));
}

// ── Contratos ──────────────────────────────────────────────────

public record RegistroRequest(string NombreCompleto, string CorreoElectronico, string ClaveAcceso);

public record LoginRequest(string CorreoElectronico, string ClaveAcceso);

public record ApiError(string Error);

public record SesionActual(Guid EstudianteId);

/// <summary>
/// Datos publicos del estudiante.
/// NUNCA se serializa la entidad <see cref="Estudiante"/> directamente: traeria el hash
/// bcrypt de <c>ClaveAcceso</c> y el <c>SecurityStamp</c>.
/// </summary>
public record EstudianteDto(Guid EstudianteId, string NombreCompleto, string CorreoElectronico, string? FotoPerfil)
{
    public static EstudianteDto Desde(Estudiante e) =>
        new(e.EstudianteId, e.NombreCompleto, e.CorreoElectronico, e.FotoPerfil);
}

public record AuthResponse(string? Token, EstudianteDto Estudiante);