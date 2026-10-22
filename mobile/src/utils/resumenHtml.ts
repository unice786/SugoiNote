import { ThemeTokens } from '../theme/tokens';

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Envuelve el HTML del resumen (subconjunto simple: h2/h3/p/ul/ol/li/strong/code)
 * en un documento con estilos del tema. `paraImpresion` usa colores claros fijos
 * para que el PDF salga legible sobre papel blanco.
 */
export function documentoResumen(
  titulo: string,
  contenido: string,
  tokens: ThemeTokens,
  paraImpresion = false
): string {
  const fondo = paraImpresion ? '#ffffff' : tokens.bgApp;
  const texto = paraImpresion ? '#111827' : tokens.textPrimary;
  const secundario = paraImpresion ? '#374151' : tokens.textSecondary;
  const acento = paraImpresion ? '#6d28d9' : tokens.accent;
  const acentoTint = paraImpresion ? 'rgba(124, 58, 237, 0.10)' : tokens.accentTint;
  const tamanoBase = paraImpresion ? '15px' : '16px';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  * { box-sizing: border-box; -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    padding: 20px;
    background: ${fondo};
    color: ${texto};
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: ${tamanoBase};
    line-height: 1.7;
  }
  h1.resumen-titulo {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0 0 4px;
    color: ${texto};
  }
  .resumen-sello {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    color: ${acento};
    background: ${acentoTint};
    border-radius: 999px;
    padding: 1px 10px;
    margin-bottom: 18px;
  }
  .resumen-contenido h2 { font-size: 1.2rem; font-weight: 700; margin: 22px 0 8px; color: ${texto}; }
  .resumen-contenido h3 { font-size: 1rem; font-weight: 600; margin: 16px 0 6px; color: ${acento}; }
  .resumen-contenido p { color: ${secundario}; margin: 0 0 10px; }
  .resumen-contenido ul,
  .resumen-contenido ol { padding-left: 22px; color: ${secundario}; margin: 0 0 10px; }
  .resumen-contenido li { margin-bottom: 5px; }
  .resumen-contenido strong { color: ${texto}; }
  .resumen-contenido code {
    background: ${acentoTint};
    color: ${acento};
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.88em;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .resumen-contenido a { color: ${acento}; }
</style>
</head>
<body>
  <h1 class="resumen-titulo">${escapar(titulo)}</h1>
  <span class="resumen-sello">Generado con IA</span>
  <div class="resumen-contenido">${contenido}</div>
</body>
</html>`;
}
