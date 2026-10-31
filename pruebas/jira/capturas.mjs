// ─────────────────────────────────────────────────────────────
// Capturas de pantalla de Jira para el informe.
//
// Abre Edge con un perfil propio (no toca el perfil normal del usuario) en la
// lista de casos del proyecto PDPS y espera a que el usuario inicie sesion.
// Cuando la sesion esta activa guarda las capturas en pruebas/jira/capturas.
//
// Uso:
//   set PLAYWRIGHT_CORE=C:\...\node_modules\playwright-core
//   node pruebas/jira/capturas.mjs
// ─────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const destino = join(raiz, 'pruebas', 'jira', 'capturas');
mkdirSync(destino, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  const ruta = process.env.PLAYWRIGHT_CORE ?? join(process.env.TEMP ?? '', 'opencode', 'pdfgen', 'node_modules', 'playwright-core');
  const modulo = await import(pathToFileURL(join(ruta, 'index.js')).href);
  chromium = modulo.chromium ?? modulo.default?.chromium;
}

const BASE = 'https://manuelangelcarias.atlassian.net';
const PERFIL = join(process.env.TEMP ?? '', 'opencode', 'perfil-jira');
const lista = `${BASE}/issues/?jql=${encodeURIComponent('project = PDPS ORDER BY key ASC')}`;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: 'msedge',
  headless: false,
  viewport: { width: 1500, height: 950 },
  deviceScaleFactor: 2,
  locale: 'es-GT',
});

const pagina = contexto.pages()[0] ?? (await contexto.newPage());
await pagina.goto(lista, { waitUntil: 'domcontentloaded' });

console.log('Esperando la sesion de Jira (inicia sesion en la ventana de Edge)...');
const minutos = Number(process.env.ESPERA_MINUTOS ?? 20);
const limite = Date.now() + minutos * 60 * 1000;
let dentro = false;
while (Date.now() < limite) {
  const url = pagina.url();
  const estado = await pagina
    .evaluate(() => ({
      enLogin: Boolean(document.querySelector('#login-form-username, input[name="username"]')),
      filas: document.querySelectorAll('a[href^="/browse/"]').length,
      titulo: document.title,
    }))
    .catch(() => ({ enLogin: true, filas: 0, titulo: '' }));
  const esJira = /\/issues|\/browse|\/jira\//.test(url) && !url.includes('id.atlassian.com');
  if (!estado.enLogin && esJira && estado.filas > 0) {
    dentro = true;
    break;
  }
  await pagina.waitForTimeout(2000);
}

if (!dentro) {
  await pagina.screenshot({ path: join(destino, '00-estado-sin-sesion.png') }).catch(() => {});
  console.error('No se inicio sesion a tiempo. Vuelve a ejecutar el script.');
  await contexto.close();
  process.exit(2);
}

console.log('Sesion activa, tomando capturas...');
await pagina.waitForTimeout(3000);

const capturas = [
  {
    archivo: '01-lista-casos.png',
    url: `${BASE}/issues/?jql=${encodeURIComponent('project = PDPS ORDER BY key ASC')}`,
    espera: 'a[href^="/browse/"]',
    descripcion: 'Lista de casos de prueba del proyecto PDPS',
  },
];

// Detalle de un caso aprobado, un caso fallido, un caso UAT y las incidencias.
const casos = JSON.parse(readFileSync(join(raiz, 'artifacts', 'pruebas', 'jira', 'casos.json'), 'utf8'));
const fallido = casos.find((c) => c.resultado === 'FAIL');
const uat = casos.find((c) => c.tipo === 'UAT');
const aprobado = casos.find((c) => c.tipo === 'UNITARIA');

for (const [n, caso, etiqueta] of [
  [2, aprobado, 'detalle-caso-aprobado'],
  [3, fallido, 'detalle-caso-fallido'],
  [4, uat, 'detalle-caso-uat'],
]) {
  if (!caso) continue;
  capturas.push({
    archivo: `0${n}-${etiqueta}-${caso.clave}.png`,
    url: `${BASE}/browse/${caso.clave}`,
    espera: '[data-testid="issue.views.issue-base.foundation.summary.heading"], h1',
    descripcion: `${caso.clave} ${caso.numero}`,
  });
}

capturas.push({
  archivo: '05-incidencias.png',
  url: `${BASE}/issues/?jql=${encodeURIComponent('project = PDPS AND issuetype = Error ORDER BY key ASC')}`,
  espera: 'a[href^="/browse/"]',
  descripcion: 'Incidencias registradas durante las pruebas',
});

for (const c of capturas) {
  await pagina.goto(c.url, { waitUntil: 'domcontentloaded' });
  try {
    await pagina.waitForSelector(c.espera, { timeout: 30000 });
  } catch {
    console.warn(`  (sin selector ${c.espera} en ${c.url})`);
  }
  await pagina.waitForTimeout(3500);
  await pagina.screenshot({ path: join(destino, c.archivo), fullPage: false });
  console.log(`+ ${c.archivo}  ${c.descripcion}`);
}

await contexto.close();
console.log(`\nCapturas en ${destino}`);
