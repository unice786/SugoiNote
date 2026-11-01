// ─────────────────────────────────────────────────────────────
// Convierte el documento final en PDF usando Edge (Chromium) y Paged.js.
//
// Paged.js arma las paginas; cuando termina, este script escribe en cada
// entrada del indice el numero de pagina real del capitulo y despues Edge
// imprime las paginas ya armadas.
//
// Uso:
//   node pruebas/informes/reporte-final.mjs
//   set PLAYWRIGHT_CORE=C:\...\node_modules\playwright-core
//   node pruebas/informes/generar-pdf.mjs
// ─────────────────────────────────────────────────────────────
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');

// Se intenta el modulo instalado en el proyecto; si no esta, se usa la copia
// temporal indicada por PLAYWRIGHT_CORE (ESM no respeta NODE_PATH).
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  const ruta = process.env.PLAYWRIGHT_CORE ?? join(process.env.TEMP ?? '', 'opencode', 'pdfgen', 'node_modules', 'playwright-core');
  const modulo = await import(pathToFileURL(join(ruta, 'index.js')).href);
  chromium = modulo.chromium ?? modulo.default?.chromium;
}

const html = process.argv[2] ? resolve(process.argv[2]) : join(raiz, 'artifacts', 'Reporte-Ejecucion-Pruebas-SugoiNote.html');
const pdf = process.argv[3] ? resolve(process.argv[3]) : join(raiz, 'artifacts', 'Reporte-Ejecucion-Pruebas-SugoiNote.pdf');

if (!existsSync(html)) {
  console.error(`No existe ${html}. Ejecuta primero reporte-final.mjs.`);
  process.exit(1);
}

const navegador = await chromium.launch({ channel: 'msedge', headless: true });
const pagina = await navegador.newPage();

// Paged.js avisa cuando termina de paginar; sin esta senal se lee el documento
// a medio armar y el indice queda incompleto.
await pagina.addInitScript(() => {
  window.__paginado = false;
  window.PagedConfig = { auto: true, after: () => { window.__paginado = true; } };
});

await pagina.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__paginado === true, { timeout: 240000 });
await pagina.waitForFunction(() => Array.from(document.images).every((i) => i.complete), { timeout: 120000 });
await pagina.evaluate(() => document.fonts.ready);
await pagina.waitForTimeout(1000);

// Numeros de pagina del indice: se calculan sobre las paginas ya armadas.
const filas = await pagina.evaluate(() => {
  const paginas = Array.from(document.querySelectorAll('.pagedjs_page'));
  const resultado = [];
  for (const enlace of document.querySelectorAll('.indice a')) {
    const id = (enlace.getAttribute('href') ?? '').replace('#', '');
    const destino = id ? document.getElementById(id) : null;
    const hoja = destino?.closest('.pagedjs_page');
    const numero = hoja ? paginas.indexOf(hoja) + 1 : null;
    enlace.querySelector('.pag')?.remove();
    const marca = document.createElement('span');
    marca.className = 'pag';
    marca.textContent = numero ?? '?';
    enlace.appendChild(marca);
    resultado.push({ id, numero, texto: enlace.textContent.trim() });
  }
  return { total: paginas.length, filas: resultado };
});

for (const f of filas.filas) {
  console.log(`${String(f.numero ?? '?').padStart(3)}  ${f.id}  ${f.texto}`);
}

const sinNumero = filas.filas.filter((f) => f.numero === null);
if (sinNumero.length) {
  console.error(`Sin pagina: ${sinNumero.map((f) => f.id).join(', ')}`);
  await navegador.close();
  process.exit(1);
}

await pagina.locator('.indice').first().screenshot({ path: join(raiz, 'artifacts', 'pruebas', 'indice-preview.png') }).catch(() => {});

await pagina.pdf({
  path: pdf,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await navegador.close();

const kb = Math.round(statSync(pdf).size / 1024);
console.log(`\nPDF: ${pdf}`);
console.log(`${filas.total} paginas, ${kb} KB`);
