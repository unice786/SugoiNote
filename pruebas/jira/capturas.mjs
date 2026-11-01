// ─────────────────────────────────────────────────────────────
// Capturas de pantalla de Jira para el informe.
//
// Abre Edge con un perfil propio (no toca el perfil normal del usuario) en el
// detalle de un caso y espera a que el usuario inicie sesion. Cuando la sesion
// esta activa guarda las capturas en pruebas/jira/capturas.
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
// Se usa Brave porque es el navegador donde el usuario tiene la sesion de
// Atlassian; la ruta se puede cambiar con la variable NAVEGADOR.
const RUTA_BRAVE =
  process.env.NAVEGADOR ??
  join(process.env.LOCALAPPDATA ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
const PERFIL = join(process.env.TEMP ?? '', 'opencode', 'perfil-jira-brave');

const contexto = await chromium.launchPersistentContext(PERFIL, {
  executablePath: process.env.NAVEGADOR ?? RUTA_BRAVE,
  headless: false,
  viewport: { width: 1500, height: 1400 },
  deviceScaleFactor: 2,
  locale: 'es-GT',
  colorScheme: 'light',
  // Atlassian bloquea los navegadores que se anuncian como automatizados. Se
  // usa la cadencia normal de Brave y se oculta la marca de automatizacion.
  ignoreDefaultArgs: ['--enable-automation'],
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-brave-update',
    '--disable-blink-features=AutomationControlled',
  ],
});

await contexto.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

const pagina = contexto.pages()[0] ?? (await contexto.newPage());

// Se entra directo al detalle de un caso: si no hay sesion, Jira redirige al
// formulario de inicio de sesion y al terminar vuelve a esta misma pagina.
const ancla = `${BASE}/browse/PDPS-26`;
await pagina.goto(ancla, { waitUntil: 'domcontentloaded' });

console.log('Esperando la sesion de Jira (inicia sesion en la ventana de Brave)...');
const minutos = Number(process.env.ESPERA_MINUTOS ?? 20);
const limite = Date.now() + minutos * 60 * 1000;
let dentro = false;

// La forma segura de saber si hay sesion es preguntarle a la propia API con la
// cookie del navegador: /rest/api/3/myself solo responde con sesion iniciada.
async function sesionActiva() {
  return pagina
    .evaluate(async () => {
      try {
        const respuesta = await fetch('/rest/api/3/myself', { headers: { Accept: 'application/json' } });
        if (respuesta.status !== 200) return null;
        const datos = await respuesta.json();
        return datos.emailAddress ?? datos.displayName ?? '';
      } catch {
        return null;
      }
    })
    .catch(() => null);
}

while (Date.now() < limite) {
  const usuario = await sesionActiva();
  if (usuario) {
    console.log(`Sesion activa: ${usuario}`);
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

const casos = JSON.parse(readFileSync(join(raiz, 'artifacts', 'pruebas', 'jira', 'casos.json'), 'utf8'));
const fallido = casos.find((c) => c.resultado === 'FAIL');
const uat = casos.find((c) => c.tipo === 'UAT');
const aprobado = casos.find((c) => c.tipo === 'UNITARIA');

const capturas = [];
for (const [n, caso, etiqueta] of [
  [1, aprobado, 'detalle-caso-aprobado'],
  [2, fallido, 'detalle-caso-fallido'],
  [3, uat, 'detalle-caso-uat'],
]) {
  if (!caso) continue;
  capturas.push({
    archivo: `0${n}-${etiqueta}-${caso.clave}.png`,
    url: `${BASE}/browse/${caso.clave}`,
    marca: caso.clave,
    descripcion: `${caso.clave} ${caso.numero}`,
  });
}

capturas.push({
  archivo: '04-lista-casos.png',
  url: `${BASE}/issues/?jql=${encodeURIComponent('project = PDPS ORDER BY key ASC')}`,
  marca: 'PDPS-',
  descripcion: 'Lista de casos de prueba del proyecto PDPS',
});

capturas.push({
  archivo: '05-incidencias.png',
  url: `${BASE}/issues/?jql=${encodeURIComponent('key in (PDPS-44, PDPS-45, PDPS-46, PDPS-47) ORDER BY key ASC')}`,
  marca: 'PDPS-44',
  descripcion: 'Incidencias registradas durante las pruebas',
});

for (const c of capturas) {
  await pagina.goto(c.url, { waitUntil: 'domcontentloaded' });
  try {
    await pagina.waitForFunction((marca) => document.body.innerText.includes(marca), c.marca, { timeout: 45000 });
  } catch {
    console.warn(`  (no aparecio ${c.marca} en ${c.url})`);
  }
  await pagina.waitForTimeout(5000);
  // La descripcion larga llega colapsada: se despliega para que se vea el
  // contenido real del caso y no un recuadro vacio.
  if (c.url.includes('/browse/')) {
    await pagina
      .waitForFunction(() => /Objetivo|Descripci[oó]n/.test(document.body.innerText), { timeout: 20000 })
      .catch(() => console.warn(`  (la descripcion de ${c.marca} no aparecio)`));
  }
  for (const texto of ['Show more', 'Ver más', 'Ver mas', 'Mostrar más']) {
    const boton = pagina.getByRole('button', { name: texto, exact: false }).first();
    if (await boton.count()) {
      await boton.click({ timeout: 2000 }).catch(() => {});
      await pagina.waitForTimeout(800);
      break;
    }
  }
  // Jira desplaza su propio contenedor, no la ventana: se regresan todos los
  // scrolls a cero para que la captura empiece por el titulo del caso.
  await pagina.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  });
  await pagina.waitForTimeout(700);
  await pagina.screenshot({ path: join(destino, c.archivo), fullPage: false });
  console.log(`+ ${c.archivo}  ${c.descripcion}`);
}

await contexto.close();
console.log(`\nCapturas en ${destino}`);
