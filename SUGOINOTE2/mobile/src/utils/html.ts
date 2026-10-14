/**
 * Conversión HTML <-> texto plano para el editor móvil.
 *
 * La web guarda el contenido como HTML (lo produce el editor de bloques).
 * React Native no tiene un editor enriquecido, así que aquí se edita en texto
 * plano y se vuelve a convertir a HTML al guardar. Es una adaptación, no un
 * port del editor de bloques: se pierde el formato, no el contenido.
 */

export function htmlATexto(html: string): string {
  if (!html) return '';

  let h = html;

  // Los saltos de línea <br> y el cierre de párrafo sí deben saltar de línea.
  h = h.replace(/<br\s*\/?>/gi, '\n');
  h = h.replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, '\n');

  // Quita todo lo que no aporta texto.
  h = h.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<[^>]+>/g, '');

  // Decodifica entidades comunes.
  h = h
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return h.replace(/\n{3,}/g, '\n\n').trim();
}

export function textoAHtml(texto: string): string {
  const limpio = (texto ?? '').replace(/\r\n/g, '\n');

  return limpio
    .split(/\n{2,}/)
    .map((bloque) => bloque.trim())
    .filter(Boolean)
    .map((bloque) => `<p>${escapar(bloque).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}