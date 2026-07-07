using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
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

            // Buscamos solo por correo para poder comparar el hash después
            var user = await _context.Estudiantes
                .FirstOrDefaultAsync(e => e.CorreoElectronico == model.CorreoElectronico);

            if (user == null)
            {
                ModelState.AddModelError(string.Empty, "Credenciales inválidas");
                return View(model);
            }

            // Verificamos la contraseña con BCrypt
            // Si la contraseña en BD no tiene el formato bcrypt (usuarios viejos),
            // hacemos comparación directa para no romper cuentas existentes.
            bool passwordValida;
            if (user.ClaveAcceso.StartsWith("$2"))
            {
                // Contraseña hasheada con BCrypt
                passwordValida = BCrypt.Net.BCrypt.Verify(model.ClaveAcceso, user.ClaveAcceso);
            }
            else
            {
                // Contraseña en texto plano (usuarios viejos)
                passwordValida = user.ClaveAcceso == model.ClaveAcceso;
            }

            if (!passwordValida)
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
                // Hasheamos la contraseña antes de guardarla
                ClaveAcceso = BCrypt.Net.BCrypt.HashPassword(model.ClaveAcceso),
                FechaCreacion = DateTime.UtcNow
            };

            _context.Estudiantes.Add(nuevo);
            await _context.SaveChangesAsync();

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

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> RecuperarContrasena(string correo, string nuevaContrasena)
        {
            var user = await _context.Estudiantes
                .FirstOrDefaultAsync(e => e.CorreoElectronico == correo);

            if (user == null)
            {
                TempData["ErrorRecuperar"] = "No existe una cuenta con ese correo.";
                return RedirectToAction("Login");
            }

            // Hasheamos la nueva contraseña antes de guardarla
            user.ClaveAcceso = BCrypt.Net.BCrypt.HashPassword(nuevaContrasena);
            await _context.SaveChangesAsync();

            TempData["ExitoRecuperar"] = "Contraseña actualizada. Ya puedes iniciar sesión.";
            return RedirectToAction("Login");
        }
    }
}