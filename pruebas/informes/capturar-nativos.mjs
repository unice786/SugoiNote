// ─────────────────────────────────────────────────────────────
// Capturas de los reportes NATIVOS que genera cada herramienta, para
// adjuntarlos como evidencia al informe final. No se retoca nada: se abre el
// HTML tal como lo dejo la herramienta y se fotografia.
//
// Uso:
//   set PLAYWRIGHT_CORE=C:\...\node_modules\playwright-core
//   node pruebas/informes/capturar-nativos.mjs
// Salida: artifacts/pruebas/nativos/*.png
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts', 'pruebas');
const destino = join(artefactos, 'nativos');
mkdirSync(destino, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  const ruta = process.env.PLAYWRIGHT_CORE ?? join(process.env.TEMP ?? '', 'opencode', 'pdfgen', 'node_modules', 'playwright-core');
  const modulo = await import(pathToFileURL(join(ruta, 'index.js')).href);
  chromium = modulo.chromium ?? modulo.default?.chromium;
}

const capturas = [
  { archivo: 'unitarias-cobertura.png', html: 'unitarias/reporte/index.html', espera: 1500 },
  { archivo: 'componentes-cobertura.png', html: 'componentes/cobertura/index.html', espera: 800 },
  { archivo: 'api-newman.png', html: 'api/newman-report.html', espera: 1800 },
  { archivo: 'carga-k6.png', html: 'rendimiento/k6-carga.html', espera: 4000 },
  { archivo: 'estres-k6.png', html: 'rendimiento/k6-estres-400.html', espera: 4000 },
  { archivo: 'seguridad-zap-baseline.png', html: 'seguridad/zap-baseline.html', espera: 1000 },
  { archivo: 'seguridad-zap-api.png', html: 'seguridad/zap-api.html', espera: 1000 },
];

const navegador = await chromium.launch({ channel: 'msedge', headless: true });
const pagina = await navegador.newPage({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 2 });

for (const c of capturas) {
  const ruta = join(artefactos, c.html);
  if (!existsSync(ruta)) {
    console.warn(`falta ${c.html}`);
    continue;
  }
  await pagina.goto(pathToFileURL(ruta).href, { waitUntil: 'load' });
  await pagina.waitForTimeout(c.espera);
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  const recorte = Math.min(1900, Math.max(700, alto));
  await pagina.screenshot({
    path: join(destino, c.archivo),
    clip: { x: 0, y: 0, width: 1400, height: recorte },
  });
  console.log(`+ ${c.archivo} (${1400}x${recorte})`);
}

await navegador.close();
console.log(`\nCapturas en ${destino}`);
