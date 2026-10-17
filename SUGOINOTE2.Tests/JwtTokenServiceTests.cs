using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SugoiNote.Services.Auth;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>Pruebas del emisor de tokens JWT que consume la app móvil.</summary>
public class JwtTokenServiceTests
{
    private const string Clave = "clave-de-prueba-suficientemente-larga-1234";

    private static JwtTokenService Servicio(int horas = 168) =>
        new(Datos.Opciones(new JwtOptions
        {
            Key = Clave,
            Issuer = "SugoiNote",
            Audience = "SugoiNoteMobile",
            ExpiracionHoras = horas,
        }));

    [Fact]
    public void Crear_DevuelveUnTokenConTresPartes()
    {
        var token = Servicio().Crear(Datos.Estudiante());

        Assert.Equal(3, token.Split('.').Length);
    }

    [Fact]
    public void Crear_IncluyeLosClaimsEsperados()
    {
        var estudiante = Datos.Estudiante(nombre: "Ana", correo: "ana@correo.com");

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(Servicio().Crear(estudiante));

        Assert.Equal(estudiante.EstudianteId.ToString(),
            jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal(estudiante.EstudianteId.ToString(),
            jwt.Claims.First(c => c.Type == ClaimTypes.NameIdentifier).Value);
        Assert.Equal("ana@correo.com",
            jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.Equal("Ana",
            jwt.Claims.First(c => c.Type == ClaimTypes.Name).Value);
    }

    [Fact]
    public void Crear_LaFirmaEsValidaConLaMismaClave()
    {
        var token = Servicio().Crear(Datos.Estudiante());
        var handler = new JwtSecurityTokenHandler();

        var principal = handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "SugoiNote",
            ValidateAudience = true,
            ValidAudience = "SugoiNoteMobile",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Clave)),
            ValidateLifetime = true,
        }, out _);

        Assert.NotNull(principal);
    }

    [Fact]
    public void Crear_LaFirmaFallaConOtraClave()
    {
        var token = Servicio().Crear(Datos.Estudiante());
        var handler = new JwtSecurityTokenHandler();

        Assert.ThrowsAny<SecurityTokenException>(() => handler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("otra-clave-totalmente-distinta-987654")),
            ValidateLifetime = false,
        }, out _));
    }

    [Fact]
    public void Crear_ExpiraSegunLaConfiguracion()
    {
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(Servicio(horas: 2).Crear(Datos.Estudiante()));

        Assert.InRange((jwt.ValidTo - jwt.ValidFrom).TotalHours, 1.9, 2.1);
    }
}
