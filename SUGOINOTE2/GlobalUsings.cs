// ImplicitUsings del Web SDK no cubre todos los namespaces que usa el proyecto.
// Se declaran aquí para no repetir los using en cada archivo.

// Autorización / autenticación
global using Microsoft.AspNetCore.Authorization;
global using Microsoft.AspNetCore.Mvc;

// Anotaciones de datos y esquema EF
global using System.ComponentModel.DataAnnotations;
global using System.ComponentModel.DataAnnotations.Schema;

// Configuración de opciones
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Options;

// EF Core
global using Microsoft.EntityFrameworkCore;

// Hangfire (panel de jobs)
global using Hangfire;
global using Hangfire.Dashboard;