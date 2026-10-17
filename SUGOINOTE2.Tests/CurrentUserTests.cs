using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SugoiNote.Services.Common;

namespace SUGOINOTE2.Tests;

/// <summary>Pruebas del accesor al estudiante autenticado (única fuente de verdad de la sesión).</summary>
public class CurrentUserTests
{
    private static CurrentUser ConContexto(ClaimsPrincipal? principal)
    {
        var acceso = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };

        if (principal is not null)
        {
            acceso.HttpContext!.User = principal;
        }

        return new CurrentUser(acceso);
    }

    private static ClaimsPrincipal Principal(params Claim[] claims) =>
        new(new ClaimsIdentity(claims, authenticationType: "Test"));

    [Fact]
    public void SinHttpContext_IdEsNull()
        => Assert.Null(new CurrentUser(new HttpContextAccessor()).Id);

    [Fact]
    public void SinClaim_IdEsNull()
        => Assert.Null(ConContexto(Principal()).Id);

    [Fact]
    public void ConClaim_DevuelveElGuid()
    {
        var id = Guid.NewGuid();

        var user = ConContexto(Principal(new Claim(ClaimTypes.NameIdentifier, id.ToString())));

        Assert.Equal(id, user.Id);
    }

    [Fact]
    public void ClaimNoParseable_IdEsNull()
        => Assert.Null(ConContexto(Principal(new Claim(ClaimTypes.NameIdentifier, "no-es-guid"))).Id);

    [Fact]
    public void RequireId_LanzaSiNoHaySesion()
        => Assert.Throws<UnauthorizedAccessException>(() => ConContexto(Principal()).RequireId());

    [Fact]
    public void RequireId_DevuelveElId()
    {
        var id = Guid.NewGuid();

        Assert.Equal(id, ConContexto(Principal(new Claim(ClaimTypes.NameIdentifier, id.ToString()))).RequireId());
    }

    [Fact]
    public void Nombre_LeeElClaim()
        => Assert.Equal("Ana", ConContexto(Principal(new Claim(ClaimTypes.Name, "Ana"))).Nombre);

    [Fact]
    public void EstaAutenticado_ReflejaLaIdentidad()
    {
        Assert.True(ConContexto(Principal()).EstaAutenticado);
        Assert.False(ConContexto(null).EstaAutenticado);
    }
}
