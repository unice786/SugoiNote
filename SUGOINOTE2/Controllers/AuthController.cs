using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models; // Esto conecta con tus modelos
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;
using SUGOINOTE2.Models.ViewModels;
using System.Threading.Tasks;

namespace SugoiNote.Controllers
{
    public class AuthController : Controller
    {
        private readonly Sugoinotee2Context _context;

        public AuthController(Sugoinotee2Context context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Login()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginVM model, string? returnUrl = null)
        {
            if (!ModelState.IsValid)
                return View(model);

            var user = await _context.Estudiantes
                .FirstOrDefaultAsync(e => e.CorreoElectronico == model.CorreoElectronico && e.ClaveAcceso == model.ClaveAcceso);

            if (user == null)
            {
                ModelState.AddModelError(string.Empty, "Credenciales inválidas");
                return View(model);
            }

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.EstudianteId.ToString()),
                new Claim(ClaimTypes.Name, user.NombreCompleto),
                new Claim(ClaimTypes.Email, user.CorreoElectronico)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                return Redirect(returnUrl);

            return RedirectToAction("Index", "Home");
        }

        [HttpGet]
        public IActionResult Register()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register(RegistroVM model)
        {
            if (!ModelState.IsValid)
                return View(model);

            var exists = await _context.Estudiantes.AnyAsync(e => e.CorreoElectronico == model.CorreoElectronico);
            if (exists)
            {
                ModelState.AddModelError("CorreoElectronico", "El correo ya está en uso");
                return View(model);
            }

            var nuevo = new Estudiante
            {
                EstudianteId = Guid.NewGuid(),
                NombreCompleto = model.NombreCompleto,
                CorreoElectronico = model.CorreoElectronico,
                ClaveAcceso = model.ClaveAcceso,
                FechaCreacion = DateTime.UtcNow
            };

            _context.Estudiantes.Add(nuevo);
            await _context.SaveChangesAsync();

            // Iniciar sesión automáticamente después del registro
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, nuevo.EstudianteId.ToString()),
                new Claim(ClaimTypes.Name, nuevo.NombreCompleto),
                new Claim(ClaimTypes.Email, nuevo.CorreoElectronico)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));

            return RedirectToAction("Index", "Home");
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Login", "Auth");
        }
    }
}
