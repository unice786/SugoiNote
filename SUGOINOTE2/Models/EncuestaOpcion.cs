using System.ComponentModel.DataAnnotations;

namespace SugoiNote.Models;

public class EncuestaOpcion
{
    public Guid OpcionId { get; set; }

    public Guid PostId { get; set; }

    [Required, MaxLength(250)]
    public string TextoOpcion { get; set; } = string.Empty;

    public int Orden { get; set; }

    public virtual ForoComunidad? Post { get; set; }
    public virtual ICollection<EncuestaVoto> Votos { get; set; } = new List<EncuestaVoto>();
}