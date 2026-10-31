// ─────────────────────────────────────────────────────────────
// Convierte el resultado de "dotnet test" (TRX + cobertura) en un reporte
// HTML legible, con el mismo estilo que los demas reportes.
//
// Uso: node pruebas/informes/reporte-dotnet.mjs
// Entrada: artifacts/pruebas/unitarias/{resultados.trx, **/coverage.cobertura.xml}
// Salida:  artifacts/pruebas/unitarias/index.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const carpeta = join(raiz, 'artifacts', 'pruebas', 'unitarias');

const atributos = (texto) => {
  const salida = {};
  for (const m of texto.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) salida[m[1]] = m[2];
  return salida;
};

const duracionMs = (texto) => {
  const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(texto ?? '');
  if (!m) return 0;
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
};

// ── TRX ──────────────────────────────────────────────────────
const trx = readFileSync(join(carpeta, 'resultados.trx'), 'utf8');

const resumen = atributos(/<Counters\b[^>]*\/>/.exec(trx)?.[0] ?? '');
const total = Number(resumen.total ?? 0);
const pasadas = Number(resumen.passed ?? 0);
const fallidas = Number(resumen.failed ?? 0);
const omitidas = Number(resumen.notExecuted ?? 0) + Number(resumen.inconclusive ?? 0);

// clase de cada prueba (desde las definiciones)
const clasePorId = new Map();
for (const m of trx.matchAll(/<UnitTest\b([^>]*)>([\s\S]*?)<\/UnitTest>/g)) {
  const id = atributos(m[1]).id;
  const metodo = /<TestMethod\b([^>]*)\/>/.exec(m[2]);
  if (id && metodo) clasePorId.set(id, atributos(metodo[1]).className);
}

const pruebas = [];
for (const m of trx.matchAll(/<UnitTestResult\b([^>]*)\/>/g)) {
  const a = atributos(m[1]);
  const clase = clasePorId.get(a.testId) ?? 'Sin clase';
  pruebas.push({
    nombre: a.testName ?? '',
    clase,
    resultado: a.outcome ?? '',
    ms: duracionMs(a.duration),
  });
}

const porClase = new Map();
for (const p of pruebas) {
  const actual = porClase.get(p.clase) ?? { clase: p.clase, total: 0, ok: 0, fallo: 0, ms: 0 };
  actual.total++;
  actual.ms += p.ms;
  if (p.resultado === 'Passed') actual.ok++;
  else actual.fallo++;
  porClase.set(p.clase, actual);
}
const clases = [...porClase.values()].sort((a, b) => b.total - a.total);

// ── Cobertura ────────────────────────────────────────────────
function buscarCobertura(dir) {
  const encontrados = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) encontrados.push(...buscarCobertura(ruta));
    else if (entrada === 'coverage.cobertura.xml') encontrados.push({ ruta, tamano: info.size });
  }
  return encontrados;
}

const archivos = buscarCobertura(carpeta).sort((a, b) => b.tamano - a.tamano);
const cobertura = archivos.length ? readFileSync(archivos[0].ruta, 'utf8') : '';

let lineaRate = 0;
let ramaRate = 0;
let clasesCobertura = [];
const lineasValidas = Number(/lines-valid="(\d+)"/.exec(cobertura)?.[1] ?? 0);
const lineasCubiertas = Number(/lines-covered="(\d+)"/.exec(cobertura)?.[1] ?? 0);
const ramasValidas = Number(/branches-valid="(\d+)"/.exec(cobertura)?.[1] ?? 0);
const ramasCubiertas = Number(/branches-covered="(\d+)"/.exec(cobertura)?.[1] ?? 0);

if (lineasValidas > 0) lineaRate = (lineasCubiertas / lineasValidas) * 100;
if (ramasValidas > 0) ramaRate = (ramasCubiertas / ramasValidas) * 100;

for (const m of cobertura.matchAll(/<class\b([^>]*?)\/?>/g)) {
  const a = atributos(m[1]);
  if (!a.filename || !a['line-rate']) continue;
  if (!/^SUGOINOTE2\//.test(a.filename.replace(/\\/g, '/'))) continue;
  clasesCobertura.push({
    clase: (a.name ?? '').split('.').pop(),
    archivo: a.filename.replace(/\\/g, '/'),
    lineas: Number(a['line-rate']) * 100,
    ramas: Number(a['branch-rate'] ?? 0) * 100,
  });
}
clasesCobertura = clasesCobertura.sort((a, b) => b.lineas - a.lineas);

const todoOk = fallidas === 0 && total > 0;
const msTotal = pruebas.reduce((s, p) => s + p.ms, 0);

const html = documento({
  titulo: 'Pruebas unitarias de la API (.NET)',
  subtitulo: 'xUnit sobre los servicios de SugoiNote, ejecutado dentro de Docker.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'Comando', valor: 'docker compose --profile pruebas run --rm tests' },
    { etiqueta: 'Framework', valor: 'xUnit + EF Core (SQLite en memoria)' },
    { etiqueta: 'Cobertura', valor: 'XPlat Code Coverage (Cobertura)' },
  ],
  tarjetas: [
    { etiqueta: 'Pruebas', valor: String(total), tono: 'acento' },
    { etiqueta: 'Correctas', valor: String(pasadas), tono: 'ok' },
    { etiqueta: 'Fallidas', valor: String(fallidas), tono: fallidas === 0 ? 'ok' : 'fallo' },
    { etiqueta: 'Duracion', valor: `${(msTotal / 1000).toFixed(1)} s`, tono: 'acento' },
    { etiqueta: 'Lineas cubiertas', valor: `${lineaRate.toFixed(1)} %`, tono: 'acento' },
    { etiqueta: 'Ramas cubiertas', valor: `${ramaRate.toFixed(1)} %`, tono: 'acento' },
  ],
  secciones: [
    `<h2>Resultado por clase de prueba</h2>`,
    tabla({
      columnas: ['Clase de prueba', 'Pruebas', 'Correctas', 'Fallidas', 'Tiempo'],
      filas: clases.map((c) => [
        `<span class="mono">${escapar(c.clase.replace('SUGOINOTE2.Tests.', ''))}</span>`,
        String(c.total),
        `<span class="ok">${c.ok}</span>`,
        c.fallo ? `<span class="fallo">${c.fallo}</span>` : '0',
        `${c.ms} ms`,
      ]),
    }),
    `<h2>Cobertura por archivo</h2>`,
    `<p class="subtitulo">Se listan solo los archivos del proyecto (sin migraciones ni codigo generado).</p>`,
    tabla({
      columnas: ['Clase', 'Archivo', 'Lineas', 'Ramas'],
      filas: clasesCobertura.map((c) => [
        `<span class="mono">${escapar(c.clase)}</span>`,
        `<span class="mono">${escapar(c.archivo)}</span>`,
        barra(c.lineas),
        barra(c.ramas),
      ]),
    }),
    `<h2>Detalle de las pruebas ejecutadas</h2>`,
    tabla({
      columnas: ['Prueba', 'Clase', 'Resultado', 'Tiempo'],
      filas: pruebas.map((p) => [
        `<span class="mono">${escapar(p.nombre)}</span>`,
        `<span class="mono">${escapar(p.clase.replace('SUGOINOTE2.Tests.', ''))}</span>`,
        `<span class="pastilla ${p.resultado === 'Passed' ? 'ok' : 'fallo'}">${p.resultado === 'Passed' ? 'OK' : escapar(p.resultado)}</span>`,
        `${p.ms} ms`,
      ]),
    }),
    omitidas ? `<div class="nota">${omitidas} prueba(s) no se ejecutaron en esta corrida.</div>` : '',
    `<div class="nota"><b>Entorno:</b> las pruebas corren en un contenedor Linux porque Smart App Control del equipo anfitrion bloquea los ensamblados no firmados que genera <code>dotnet test</code>. Usan SQLite en memoria: no tocan la base de datos de produccion.</div>`,
    `<div class="nota"><b>Sobre la cobertura:</b> las 159 pruebas se concentran en la capa de servicios, que es donde vive la logica de negocio. Los controladores y las vistas se validan con las pruebas de API (Newman) y las pruebas end-to-end, que no cuentan para esta metrica.</div>`,
  ],
});

function barra(porcentaje) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  const color = valor >= 70 ? 'var(--ok)' : valor >= 40 ? 'var(--aviso)' : 'var(--fallo)';
  return `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:76px;height:6px;border-radius:3px;background:var(--borde)"><span style="display:block;width:${valor}%;height:6px;border-radius:3px;background:${color}"></span></span><span class="mono">${valor.toFixed(1)} %</span></div>`;
}

writeFileSync(join(carpeta, 'index.html'), html, 'utf8');
console.log(`Reporte: ${join(carpeta, 'index.html')}`);
console.log(`${pasadas}/${total} pruebas, ${lineaRate.toFixed(1)} % de lineas, ${ramaRate.toFixed(1)} % de ramas`);
if (!todoOk) process.exit(1);
