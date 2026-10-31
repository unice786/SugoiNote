// ─────────────────────────────────────────────────────────────
// Plantilla unica para todos los reportes de prueba.
//
// Todos los reportes (unitarias, componentes, API, E2E, seguridad,
// rendimiento) se generan con este mismo estilo para que la entrega se vea
// como un solo documento y no como siete herramientas distintas.
//
// No usa dependencias: devuelve una cadena HTML autocontenida.
// ─────────────────────────────────────────────────────────────

export const CSS = `
  :root {
    --fondo: #0b1120;
    --panel: #111c30;
    --panel-2: #16233a;
    --borde: #22314b;
    --texto: #e6edf7;
    --texto-suave: #94a3b8;
    --acento: #7c9cff;
    --ok: #34d399;
    --fallo: #f87171;
    --aviso: #fbbf24;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 32px 72px;
    background: var(--fondo);
    color: var(--texto);
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
  }
  .lienzo { max-width: 1080px; margin: 0 auto; }
  header.encabezado { border-bottom: 1px solid var(--borde); padding-bottom: 20px; margin-bottom: 28px; }
  .marca { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--acento); font-weight: 700; }
  h1 { font-size: 30px; margin: 8px 0 6px; line-height: 1.2; }
  .subtitulo { color: var(--texto-suave); font-size: 15px; margin: 0; }
  .meta { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px 22px; color: var(--texto-suave); font-size: 12.5px; }
  .meta b { color: var(--texto); font-weight: 600; }
  .tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 24px 0 32px; }
  .tarjeta { background: var(--panel); border: 1px solid var(--borde); border-radius: 12px; padding: 16px 18px; }
  .tarjeta .valor { font-size: 26px; font-weight: 700; line-height: 1.1; }
  .tarjeta .etiqueta { color: var(--texto-suave); font-size: 12px; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
  .ok { color: var(--ok); }
  .fallo { color: var(--fallo); }
  .aviso { color: var(--aviso); }
  .acento { color: var(--acento); }
  h2 { font-size: 19px; margin: 34px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--borde); }
  h3 { font-size: 15px; margin: 22px 0 8px; }
  p { margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--borde); vertical-align: top; }
  th { color: var(--texto-suave); font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  code, .mono { font-family: "Cascadia Mono", Consolas, monospace; font-size: 12.5px; }
  .pastilla { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
  .pastilla.ok { background: rgba(52, 211, 153, .14); color: var(--ok); }
  .pastilla.fallo { background: rgba(248, 113, 113, .14); color: var(--fallo); }
  .pastilla.aviso { background: rgba(251, 191, 36, .14); color: var(--aviso); }
  .pastilla.neutra { background: rgba(148, 163, 184, .14); color: var(--texto-suave); }
  .flujo { background: var(--panel); border: 1px solid var(--borde); border-radius: 12px; padding: 16px 18px; margin: 14px 0; }
  .flujo .cabecera { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .flujo .nombre { font-weight: 700; font-size: 15px; }
  .flujo ul { margin: 10px 0 0; padding-left: 18px; }
  .flujo li { margin: 3px 0; color: var(--texto-suave); }
  .flujo li.ok b { color: var(--ok); }
  .flujo li.fallo b { color: var(--fallo); }
  .nota { background: var(--panel-2); border-left: 3px solid var(--acento); border-radius: 6px; padding: 12px 14px; margin: 14px 0; color: var(--texto-suave); }
  .nota b { color: var(--texto); }
  footer.pie { margin-top: 44px; padding-top: 16px; border-top: 1px solid var(--borde); color: var(--texto-suave); font-size: 12px; }
  @media print {
    body { background: #fff; color: #111; padding: 0; }
    .tarjeta, .flujo, .nota { background: #f8fafc; border-color: #d7dee9; }
    h1, h2, h3, .tarjeta .valor { color: #0b1120; }
    .subtitulo, .meta, .flujo li, .nota, footer.pie, th, .tarjeta .etiqueta { color: #475569; }
    .meta b, .nota b { color: #0b1120; }
    th, td { border-color: #d7dee9; }
    .lienzo { max-width: none; }
    .evitar-corte { break-inside: avoid; }
  }
`;

export function escapar(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tabla({ columnas, filas, clases = [] }) {
  const encabezado = columnas.map((c) => `<th>${escapar(c)}</th>`).join('');
  const cuerpo = filas
    .map((fila) => {
      const celdas = fila
        .map((celda, i) => `<td${clases[i] ? ` class="${clases[i]}"` : ''}>${celda}</td>`)
        .join('');
      return `<tr>${celdas}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>`;
}

export function documento({
  titulo,
  subtitulo,
  meta = [],
  tarjetas = [],
  secciones = [],
  pie = 'SugoiNote · Reporte generado automaticamente',
}) {
  const metaHtml = meta.map((m) => `<span><b>${escapar(m.etiqueta)}:</b> ${escapar(m.valor)}</span>`).join('');
  const tarjetasHtml = tarjetas
    .map(
      (t) =>
        `<div class="tarjeta"><div class="valor ${t.tono ?? ''}">${t.valor}</div><div class="etiqueta">${escapar(t.etiqueta)}</div></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapar(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="lienzo">
  <header class="encabezado">
    <div class="marca">SugoiNote · PDPS</div>
    <h1>${escapar(titulo)}</h1>
    <p class="subtitulo">${escapar(subtitulo)}</p>
    ${metaHtml ? `<div class="meta">${metaHtml}</div>` : ''}
  </header>
  ${tarjetasHtml ? `<div class="tarjetas">${tarjetasHtml}</div>` : ''}
  ${secciones.join('\n')}
  <footer class="pie">${escapar(pie)}</footer>
</div>
</body>
</html>`;
}
