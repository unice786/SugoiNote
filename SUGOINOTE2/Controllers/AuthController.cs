using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SugoiNote.Models;
using SugoiNote.Models.ViewModels;
using SugoiNote.Services.Auth;

namespace SugoiNote.Controllers;

[AllowAnonymous]
public class AuthController(IAuthService auth, ILogger<AuthController> logger) : Controller
{
    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Home");

        ViewBag.ReturnUrl = returnUrl;
        return View(new LoginVM { ReturnUrl = returnUrl });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("Login")]
    public async Task<IActionResult> Login(LoginVM model, CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return View(model);

        var (resultado, estudiante) = await auth.ValidarCredencialesAsync(model.CorreoElectronico, model.ClaveAcceso, ct);

        if (!resultado.Exito)
        {
            ModelState.AddModelError(string.Empty, resultado.Error ?? "No se pudo iniciar sesión.");
            return View(model);
        }

        await EmitirCookie(estudiante!, model.ReturnUrl);
        logger.LogInformation("Inicio de sesión del estudiante {EstudianteId}", estudiante!.EstudianteId);

        return Redirect(Seguro(model.ReturnUrl));
    }

    [HttpGet]
    public IActionResult Register()
    {
        if (User.Identity?.IsAuthenticated == true) return RedirectToAction("Index", "Home");
        return View(new RegistroVM());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Register(RegistroVM model, CancellationToken ct)
    {
        if (!ModelState.IsValid) return View(model);

        var resultado = await auth.RegistrarAsync(model.NombreCompleto, model.CorreoElectronico, model.ClaveAcceso, ct);

        if (!resultado.Exito)
        {
            ModelState.AddModelError(string.Empty, resultado.Error ?? "No se pudo crear la cuenta.");
            return View(model);
        }

        TempData["Exito"] = "¡Cuenta creada! Ya puedes iniciar sesión.";
        return RedirectToAction(nameof(Login));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    // ── Recuperación de contraseña (FIX C1) ───────────────────
    //
    // Antes `RecuperarContrasena` recibía correo + nuevaContraseña y sobrescribía el hash
    // sin comprobar quiénEra: cualquier visitante podía tomar cualquier cuenta.
    // Ahora el cambio solo ocurre con un token de un uso, enviado por email y con caducidad.

    [HttpGet]
    public IActionResult OlvideClave() => View(new OlvideClaveVM());

    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("Login")]
    public async Task<IActionResult> OlvideClave(OlvideClaveVM model, CancellationToken ct)
    {
        var (_, mensaje, tokenDev) = await auth.SolicitarResetAsync(model.CorreoElectronico, ct);

        // Siempre la misma vista y el mismo texto: no revela si el correo existe.
        TempData["Exito"] = mensaje;

        if (tokenDev is not null)
        {
            // Solo en desarrollo (sin SMTP configurado) el enlace se muestra en pantalla
            // para poder completar la prueba.
            ViewBag.TokenDesarrollo = tokenDev;
        }

        return View();
    }

    [HttpGet]
    public IActionResult Restablecer(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return RedirectToAction(nameof(OlvideClave));

        return View(new RestablecerClaveVM());
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Restablecer(string? token, RestablecerClaveVM model, CancellationToken ct)
    {
        var resultado = await auth.RestablecerConTokenAsync(token ?? string.Empty, model.NuevaClave, ct);

        if (!resultado.Exito)
        {
            ModelState.AddModelError(string.Empty, resultado.Error ?? "No se pudo restablecer la contraseña.");
            return View(model);
        }

        TempData["Exito"] = "Contraseña restablecida. Ya puedes iniciar sesión.";
        return RedirectToAction(nameof(Login));
    }

    // ── Apoyo ─────────────────────────────────────────────────

    private async Task EmitirCookie(Estudiante estudiante, string? returnUrl)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, estudiante.EstudianteId.ToString()),
            new(ClaimTypes.Name, estudiante.NombreCompleto),
            new(ClaimTypes.Email, estudiante.CorreoElectronico),
            new("SecurityStamp", estudiante.SecurityStamp ?? string.Empty),
        };

        var identidad = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identidad),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(7) });
    }

    /// <summary>Evita redirecciones hacia sitios externos (open redirect).</summary>
    private string Seguro(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)
            ? returnUrl
            : Url.Action("Index", "Home")!;
}