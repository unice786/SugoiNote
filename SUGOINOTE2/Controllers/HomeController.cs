using SugoiNote.Models.ViewModels;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Controllers;

/// <summary>Landing de la aplicación y páginas de error. Accesible sin autenticar.</summary>
public class HomeController(IApunteService apuntes, ICurrentUser usuario, ILogger<HomeController> logger) : Controller
{
    [AllowAnonymous]
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        // El guard de autenticación vive aquí en lugar de repetirse en cada vista.
        if (!usuario.EstaAutenticado) return RedirectToAction("Login", "Auth");

        try
        {
            var todos = await apuntes.ListarAsync(usuario.RequireId(), ct);
            var recientes = todos.OrderByDescending(a => a.FechaRegistro).Take(6);

            ViewBag.NombreReal = usuario.Nombre ?? "Estudiante";
            ViewBag.TotalApuntes = todos.Count;

            return View(recientes.Select(Mapear).ToList());
        }
        catch (Exception ex)
        {
            // Antes este catch no logueaba nada: un fallo de BD se veía como "no tienes apuntes".
            logger.LogError(ex, "No se pudo cargar el panel de inicio");
            TempData["Error"] = "No se pudieron cargar tus apuntes. Inténtalo de nuevo en unos segundos.";
            ViewBag.NombreReal = usuario.Nombre ?? "Estudiante";
            ViewBag.TotalApuntes = 0;
            return View(new List<ApunteVM>());
        }
    }

    // FIX C9: Program.cs apuntaba a /Home/Error pero esta acción no existía,
    // de modo que toda excepción en producción terminaba en un 404.
    [AllowAnonymous]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error(string? message)
    {
        var traceId = Activity.Current?.Id ?? HttpContext.TraceIdentifier;

        var model = new ErrorViewModel
        {
            RequestId = traceId,
            Mensaje = message,
        };

        if (Request.Headers.ContainsKey("X-Requested-With"))
        {
            // Peticiones AJAX: responder JSON y no HTML.
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = message ?? "Se produjo un error inesperado.",
                traceId,
            });
        }

        return View(model);
    }

    /// <summary>Páginas de 404/403 re-ejecutadas por <c>UseStatusCodePagesWithReExecute</c>.</summary>
    [AllowAnonymous]
    public IActionResult CodigoError(int codigo)
    {
        Response.StatusCode = codigo;

        var model = new ErrorViewModel
        {
            RequestId = HttpContext.TraceIdentifier,
            Codigo = codigo,
            Mensaje = codigo switch
            {
                404 => "La página que buscas no existe o ya no está disponible.",
                403 => "No tienes permiso para ver esta página.",
                429 => "Has hecho demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
                >= 500 => "Algo salió mal en nuestro servidor. Ya lo estamos mirando.",
                _ => null,
            },
        };

        return View("Error", model);
    }

    internal static ApunteVM Mapear(ApunteListItem a) => new()
    {
        ApunteId = a.ApunteId,
        TituloNota = a.TituloNota,
        MateriaId = a.MateriaId,
        NombreMateria = a.NombreMateria,
        FechaRegistro = a.FechaRegistro,
        TieneResumen = a.TieneResumen,
    };
}