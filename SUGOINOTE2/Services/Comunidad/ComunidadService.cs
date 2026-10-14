using Microsoft.EntityFrameworkCore;
using SugoiNote.Models;
using SugoiNote.Services.Apuntes;
using SugoiNote.Services.Common;

namespace SugoiNote.Services.Comunidad;

public class AvatarInfo
{
    public string Nombre { get; set; } = string.Empty;
    public string? FotoUrl { get; set; }
}

public class OpcionPost
{
    public Guid OpcionId { get; set; }
    public string TextoOpcion { get; set; } = string.Empty;
    public int TotalVotos { get; set; }
}

public class RespuestaPost
{
    public Guid RespuestaId { get; set; }
    public string TextoRespuesta { get; set; } = string.Empty;
    public DateTime? FechaRespuesta { get; set; }
    public AvatarInfo Autor { get; set; } = new();
}

public class PostListItem
{
    public Guid PostId { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Detalle { get; set; } = string.Empty;
    public DateTime? FechaPublicacion { get; set; }
    public string TipoPost { get; set; } = "Pregunta";
    public string? ImagenUrl { get; set; }
    public bool SoloUna { get; set; } = true;
    public Guid? AutorId { get; set; }
    public bool EsMio { get; set; }
    public AvatarInfo Autor { get; set; } = new();
    public int TotalRespuestas { get; set; }
    public int TotalVotos { get; set; }
    public List<OpcionPost> Opciones { get; set; } = [];
    public HashSet<Guid> OpcionesVotadas { get; set; } = [];
    public bool YaVoto { get; set; }
}

public class PostConRespuestas : PostListItem
{
    public List<RespuestaPost> Respuestas { get; set; } = [];
}

public interface IComunidadService
{
    Task<(IReadOnlyList<PostListItem> Posts, bool HayMas)> ListarAsync(Guid estudianteId, int pagina, int tamano, CancellationToken ct = default);
    Task<PostConRespuestas?> ObtenerAsync(Guid postId, Guid estudianteId, CancellationToken ct = default);
    Task<(bool Ok, string? Error, Guid? PostId)> CrearPostAsync(Guid estudianteId, string titulo, string detalle, string? imagenUrl, CancellationToken ct = default);
    Task<(bool Ok, string? Error, Guid? PostId)> CrearEncuestaAsync(Guid estudianteId, string titulo, string detalle, List<string> opciones, string? imagenUrl, bool soloUna, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> VotarAsync(Guid estudianteId, Guid postId, Guid opcionId, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> ResponderAsync(Guid estudianteId, Guid postId, string texto, CancellationToken ct = default);
    Task<(bool Ok, string? Error)> EliminarPostAsync(Guid postId, Guid estudianteId, CancellationToken ct = default);
}

public class ComunidadService(Sugoinotee2Context db, IHtmlSanitizer sanitizer, ILogger<ComunidadService> logger) : IComunidadService
{
    public async Task<(IReadOnlyList<PostListItem>, bool)> ListarAsync(Guid estudianteId, int pagina, int tamano, CancellationToken ct = default)
    {
        pagina = Math.Max(0, pagina);
        tamano = Math.Clamp(tamano, 1, 50);

        var consulta = db.ForoComunidades.AsNoTracking()
            .Where(p => p.Estudiante != null)
            .OrderByDescending(p => p.FechaPublicacion);

        // Se pide una fila extra para saber si hay siguiente pagina sin un COUNT.
        var filas = await consulta
            .Skip(pagina * tamano).Take(tamano + 1)
            .Select(p => new PostFila
            {
                PostId = p.PostId,
                Titulo = p.TituloPregunta,
                Detalle = p.DetallePregunta,
                FechaPublicacion = p.FechaPublicacion,
                TipoPost = p.TipoPost,
                ImagenUrl = p.ImagenUrl,
                SoloUna = p.SoloUnaOpcion,
                AutorId = p.EstudianteId,
                AutorNombre = p.Estudiante!.NombreCompleto,
                AutorFoto = p.Estudiante.FotoPerfil,
                TotalRespuestas = p.Respuestas.Count,
                Opciones = p.OpcionesEncuesta.Select(o => new OpcionFila
                {
                    OpcionId = o.OpcionId,
                    TextoOpcion = o.TextoOpcion,
                    Orden = o.Orden,
                    TotalVotos = o.Votos.Count,
                }).ToList(),
            })
            .ToListAsync(ct);

        var hayMas = filas.Count > tamano;
        if (hayMas) filas.RemoveAt(filas.Count - 1);

        var postIds = filas.Select(f => f.PostId).ToList();

        var votos = await db.EncuestaVotos.AsNoTracking()
            .Where(v => v.EstudianteId == estudianteId && postIds.Contains(v.PostId))
            .Select(v => new { v.PostId, v.OpcionId })
            .ToListAsync(ct);

        var mapaVotos = votos
            .GroupBy(v => v.PostId)
            .ToDictionary(g => g.Key, g => g.Select(v => v.OpcionId).ToHashSet());

        var posts = filas.Select(f =>
        {
            var marcadas = mapaVotos.GetValueOrDefault(f.PostId) ?? [];
            return new PostListItem
            {
                PostId = f.PostId,
                Titulo = f.Titulo,
                Detalle = f.Detalle,
                FechaPublicacion = f.FechaPublicacion,
                TipoPost = f.TipoPost,
                ImagenUrl = sanitizer.SanitizeUrl(f.ImagenUrl),
                SoloUna = f.SoloUna,
                AutorId = f.AutorId,
                EsMio = f.AutorId == estudianteId,
                Autor = new AvatarInfo { Nombre = f.AutorNombre ?? "Usuario", FotoUrl = sanitizer.SanitizeUrl(f.AutorFoto) },
                TotalRespuestas = f.TotalRespuestas,
                Opciones = f.Opciones.OrderBy(o => o.Orden).Select(o => new OpcionPost
                {
                    OpcionId = o.OpcionId,
                    TextoOpcion = o.TextoOpcion,
                    TotalVotos = o.TotalVotos,
                }).ToList(),
                OpcionesVotadas = marcadas,
                YaVoto = marcadas.Count > 0,
                TotalVotos = f.Opciones.Sum(o => o.TotalVotos),
            };
        }).ToList();

        return (posts, hayMas);
    }

    public async Task<PostConRespuestas?> ObtenerAsync(Guid postId, Guid estudianteId, CancellationToken ct = default)
    {
        var datos = await db.ForoComunidades.AsNoTracking()
            .Where(p => p.PostId == postId && p.Estudiante != null)
            .Select(p => new
            {
                p.PostId,
                p.TituloPregunta,
                p.DetallePregunta,
                p.FechaPublicacion,
                p.TipoPost,
                p.ImagenUrl,
                SoloUna = p.SoloUnaOpcion,
                AutorId = p.EstudianteId,
                AutorNombre = p.Estudiante!.NombreCompleto,
                AutorFoto = p.Estudiante.FotoPerfil,
                Respuestas = p.Respuestas.Select(r => new
                {
                    r.RespuestaId,
                    r.TextoRespuesta,
                    r.FechaRespuesta,
                    Nombre = r.Estudiante != null ? r.Estudiante.NombreCompleto : "Usuario",
                    Foto = r.Estudiante != null ? r.Estudiante.FotoPerfil : null,
                }).OrderBy(r => r.FechaRespuesta).ToList(),
                Opciones = p.OpcionesEncuesta.Select(o => new { o.OpcionId, o.TextoOpcion, o.Orden, TotalVotos = o.Votos.Count }).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (datos is null) return null;

        var votos = await db.EncuestaVotos.AsNoTracking()
            .Where(v => v.EstudianteId == estudianteId && v.PostId == postId)
            .Select(v => v.OpcionId)
            .ToListAsync(ct);

        var marcadas = votos.ToHashSet();

        return new PostConRespuestas
        {
            PostId = datos.PostId,
            Titulo = datos.TituloPregunta,
            Detalle = datos.DetallePregunta,
            FechaPublicacion = datos.FechaPublicacion,
            TipoPost = datos.TipoPost,
            ImagenUrl = sanitizer.SanitizeUrl(datos.ImagenUrl),
            EsMio = datos.AutorId == estudianteId,
            Autor = new AvatarInfo { Nombre = datos.AutorNombre ?? "Usuario", FotoUrl = sanitizer.SanitizeUrl(datos.AutorFoto) },
            TotalRespuestas = datos.Respuestas.Count,
            Opciones = datos.Opciones.OrderBy(o => o.Orden).Select(o => new OpcionPost
            {
                OpcionId = o.OpcionId,
                TextoOpcion = o.TextoOpcion,
                TotalVotos = o.TotalVotos,
            }).ToList(),
            OpcionesVotadas = marcadas,
            YaVoto = marcadas.Count > 0,
            TotalVotos = datos.Opciones.Sum(o => o.TotalVotos),
            Respuestas = datos.Respuestas.Select(r => new RespuestaPost
            {
                RespuestaId = r.RespuestaId,
                TextoRespuesta = r.TextoRespuesta,
                FechaRespuesta = r.FechaRespuesta,
                Autor = new AvatarInfo { Nombre = r.Nombre ?? "Usuario", FotoUrl = sanitizer.SanitizeUrl(r.Foto) },
            }).ToList(),
        };
    }

    public async Task<(bool Ok, string? Error, Guid? PostId)> CrearPostAsync(Guid estudianteId, string titulo, string detalle, string? imagenUrl, CancellationToken ct = default)
    {
        var t = (titulo ?? string.Empty).Trim();
        if (t.Length == 0) return (false, "Escribe un título para la publicación.", null);
        if (t.Length > 200) t = t[..200];

        var d = (detalle ?? string.Empty).Trim();
        if (d.Length == 0) return (false, "Escribe el contenido de la publicación.", null);

        var post = new ForoComunidad
        {
            PostId = Guid.NewGuid(),
            TituloPregunta = t,
            DetallePregunta = d,
            EstudianteId = estudianteId,
            FechaPublicacion = DateTime.UtcNow,
            TipoPost = "Pregunta",
            ImagenUrl = sanitizer.SanitizeUrl(imagenUrl),
        };

        db.ForoComunidades.Add(post);
        await db.SaveChangesAsync(ct);
        return (true, null, post.PostId);
    }

    public async Task<(bool Ok, string? Error, Guid? PostId)> CrearEncuestaAsync(Guid estudianteId, string titulo, string detalle, List<string> opciones, string? imagenUrl, bool soloUna, CancellationToken ct = default)
    {
        var t = (titulo ?? string.Empty).Trim();
        if (t.Length == 0) return (false, "Escribe un título para la encuesta.", null);
        if (t.Length > 200) t = t[..200];

        // El enunciado va en DetallePregunta: es NOT NULL y antes se hardcodeaba "Encuesta",
        // lo que hacia que la vista no tuviera nada que mostrar.
        var d = (detalle ?? string.Empty).Trim();
        if (d.Length == 0) d = "Encuesta";

        var limpias = opciones
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (limpias.Count < 2) return (false, "Una encuesta necesita al menos 2 opciones.", null);
        if (limpias.Count > 10) return (false, "Una encuesta no puede tener más de 10 opciones.", null);

        if (limpias.Any(o => o.Length > 250))
            return (false, "Alguna opción supera los 250 caracteres.", null);

        var post = new ForoComunidad
        {
            PostId = Guid.NewGuid(),
            TituloPregunta = t,
            DetallePregunta = d,
            EstudianteId = estudianteId,
            FechaPublicacion = DateTime.UtcNow,
            TipoPost = "Encuesta",
            SoloUnaOpcion = soloUna,
            ImagenUrl = sanitizer.SanitizeUrl(imagenUrl),
            OpcionesEncuesta = limpias.Select((texto, i) => new EncuestaOpcion
            {
                OpcionId = Guid.NewGuid(),
                TextoOpcion = texto,
                Orden = i,
            }).ToList(),
        };

        db.ForoComunidades.Add(post);
        await db.SaveChangesAsync(ct);
        return (true, null, post.PostId);
    }

    public async Task<(bool Ok, string? Error)> VotarAsync(Guid estudianteId, Guid postId, Guid opcionId, CancellationToken ct = default)
    {
        var post = await db.ForoComunidades
            .Include(p => p.OpcionesEncuesta)
            .FirstOrDefaultAsync(p => p.PostId == postId, ct);

        if (post is null) return (false, "La publicación no existe.");
        if (post.TipoPost != "Encuesta") return (false, "Esta publicación no es una encuesta.");

        var opcion = post.OpcionesEncuesta.FirstOrDefault(o => o.OpcionId == opcionId);
        if (opcion is null) return (false, "Esa opción no pertenece a esta encuesta.");

        var yaVoto = await db.EncuestaVotos
            .AnyAsync(v => v.PostId == postId && v.EstudianteId == estudianteId, ct);

        // EF está configurado con EnableRetryOnFailure; con esa estrategia NO se puede
        // abrir una transacción a mano. Hay que envolver la unidad reintentable en la
        // estrategia de ejecución. Sin esto, votar devolvía un 500
        // (SqlServerRetryingExecutionStrategy no admite transacciones del usuario).
        var estrategia = db.Database.CreateExecutionStrategy();
        return await estrategia.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            if (yaVoto)
            {
                if (post.SoloUnaOpcion)
                {
                    await db.EncuestaVotos
                        .Where(v => v.PostId == postId && v.EstudianteId == estudianteId)
                        .ExecuteDeleteAsync(ct);
                }
                else
                {
                    // Opcion multiple: alternar el voto en lugar de duplicarlo.
                    var previo = await db.EncuestaVotos
                        .FirstOrDefaultAsync(v => v.PostId == postId && v.EstudianteId == estudianteId && v.OpcionId == opcionId, ct);

                    if (previo is not null)
                    {
                        db.EncuestaVotos.Remove(previo);
                        await db.SaveChangesAsync(ct);
                        await tx.CommitAsync(ct);
                        return (true, (string?)null);
                    }
                }
            }

            db.EncuestaVotos.Add(new EncuestaVoto
            {
                VotoId = Guid.NewGuid(),
                PostId = postId,
                OpcionId = opcionId,
                EstudianteId = estudianteId,
                FechaVoto = DateTime.UtcNow,
            });

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return (true, (string?)null);
        });
    }

    public async Task<(bool Ok, string? Error)> ResponderAsync(Guid estudianteId, Guid postId, string texto, CancellationToken ct = default)
    {
        var t = (texto ?? string.Empty).Trim();
        if (t.Length == 0) return (false, "Escribe tu respuesta.");
        if (t.Length > 4000) t = t[..4000];

        var existe = await db.ForoComunidades.AnyAsync(p => p.PostId == postId, ct);
        if (!existe) return (false, "La publicación no existe.");

        db.RespuestasForo.Add(new RespuestaForo
        {
            RespuestaId = Guid.NewGuid(),
            PostId = postId,
            EstudianteId = estudianteId,
            TextoRespuesta = t,
            FechaRespuesta = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> EliminarPostAsync(Guid postId, Guid estudianteId, CancellationToken ct = default)
    {
        var post = await db.ForoComunidades.FirstOrDefaultAsync(p => p.PostId == postId, ct);

        if (post is null) return (false, "La publicación no existe.");
        if (post.EstudianteId != estudianteId) return (false, "Solo puedes borrar tus propias publicaciones.");

        try
        {
            // Las respuestas, opciones y votos caen por ON DELETE CASCADE.
            db.ForoComunidades.Remove(post);
            await db.SaveChangesAsync(ct);
            return (true, null);
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Fallo al eliminar el post {PostId}", postId);
            return (false, "No se pudo eliminar la publicación.");
        }
    }

    // ── Proyecciones ───────────────────────────────────────────

    private sealed class PostFila
    {
        public Guid PostId { get; init; }
        public string Titulo { get; init; } = "";
        public string Detalle { get; init; } = "";
        public DateTime? FechaPublicacion { get; init; }
        public string TipoPost { get; init; } = "";
        public bool SoloUna { get; init; } = true;
        public string? ImagenUrl { get; init; }
        public Guid? AutorId { get; init; }
        public string? AutorNombre { get; init; }
        public string? AutorFoto { get; init; }
        public int TotalRespuestas { get; init; }
        public List<OpcionFila> Opciones { get; init; } = [];
    }

    private sealed class OpcionFila
    {
        public Guid OpcionId { get; init; }
        public string TextoOpcion { get; init; } = "";
        public int Orden { get; init; }
        public int TotalVotos { get; init; }
    }
}