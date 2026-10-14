using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SugoiNote.Models;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Auth;

public interface IJwtTokenService
{
    /// <summary>Emite un token para el estudiante indicado.</summary>
    string Crear(Estudiante estudiante);
}

/// <summary>
/// Emite los tokens JWT que consume la app movil.
/// El cliente web no lo usa: sigue autenticandose con la cookie de sesion.
/// </summary>
public class JwtTokenService(IOptions<JwtOptions> options) : IJwtTokenService
{
    private readonly JwtOptions _opt = options.Value;

    public string Crear(Estudiante estudiante)
    {
        var id = estudiante.EstudianteId;

        // Se emiten los dos identificadores a proposito: "sub" es lo que espera el
        // JwtSecurityTokenHandler, y ClaimTypes.NameIdentifier es lo que lee
        // CurrentUser. Asi el mismo token sirve para el middleware y para el codigo.
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, id.ToString()),
            new(ClaimTypes.NameIdentifier, id.ToString()),
            new(JwtRegisteredClaimNames.Email, estudiante.CorreoElectronico ?? string.Empty),
            new(ClaimTypes.Name, estudiante.NombreCompleto ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var credenciales = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _opt.Issuer,
            audience: _opt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(_opt.ExpiracionHoras),
            signingCredentials: credenciales);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}