using Microsoft.AspNetCore.Mvc;
using SugoiNote.Models; // Asegúrate que diga SugoiNote
using SUGOINOTE2.Models;
using System.Diagnostics;

namespace SugoiNote.Controllers
{
    public class HomeController : Controller
    {
        // Cambiamos ApplicationDbContext por Sugoinotee2Context
        private readonly Sugoinotee2Context _context;

        public HomeController(Sugoinotee2Context context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}