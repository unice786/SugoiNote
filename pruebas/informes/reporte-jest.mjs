// ─────────────────────────────────────────────────────────────
// Convierte la salida de Jest en un reporte HTML legible.
//
// Uso: node pruebas/informes/reporte-jest.mjs
// Entrada: artifacts/pruebas/componentes/{resultados.json, cobertura/coverage-summary.json}
// Salida:  artifacts/pruebas/componentes/index.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const carpeta = join(raiz, 'artifacts', 'pruebas', 'componentes');

const jest = JSON.parse(readFileSync(join(carpeta, 'resultados.json'), 'utf8'));

let cobertura = null;
try {
  cobertura = JSON.parse(readFileSync(join(carpeta, 'cobertura', 'coverage-summary.json'), 'utf8'));
} catch {
  /* la corrida puede hacerse sin --coverage */
}

const suites = jest.testResults.map((s) => ({
  archivo: s.name.replace(/^.*?__tests__[\\/]/, '').replace(/\\/g, '/'),
  estado: s.status,
  pruebas: s.assertionResults.map((a) => ({
    nombre: a.fullName,
    estado: a.status,
    ms: a.duration ?? 0,
    error: a.failureMessages?.[0] ?? '',
  })),
}));

const total = jest.numTotalTests;
const correctas = jest.numPassedTests;
const fallidas = jest.numFailedTests;
const msTotal = suites.reduce((s, x) => s + x.pruebas.reduce((a, p) => a + p.ms, 0), 0);

const archivosCobertura = cobertura
  ? Object.entries(cobertura)
      .filter(([ruta]) => ruta !== 'total')
      .map(([ruta, datos]) => ({
        archivo: ruta.replace(/^.*?\/src\//, 'src/').replace(/\\/g, '/'),
        lineas: datos.lines.pct,
        sentencias: datos.statements.pct,
        ramas: datos.branches.pct,
        funciones: datos.functions.pct,
      }))
      .sort((a, b) => b.lineas - a.lineas)
  : [];

function barra(porcentaje) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  const color = valor >= 70 ? 'var(--ok)' : valor >= 40 ? 'var(--aviso)' : 'var(--fallo)';
  return `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:76px;height:6px;border-radius:3px;background:var(--borde)"><span style="display:block;width:${valor}%;height:6px;border-radius:3px;background:${color}"></span></span><span class="mono">${valor.toFixed(1)} %</span></div>`;
}

const todoOk = fallidas === 0 && total > 0;

const html = documento({
  titulo: 'Pruebas de componentes React Native',
  subtitulo: 'Jest + jest-expo + Testing Library sobre los componentes reutilizables de la app movil.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'Comando', valor: 'docker run --rm ... npx jest --ci --coverage' },
    { etiqueta: 'Entorno', valor: 'Node 22 + jest-expo (Expo SDK 57)' },
    { etiqueta: 'Componentes cubiertos', valor: 'Button, Badge, Input, EmptyState' },
  ],
  tarjetas: [
    { etiqueta: 'Suites', valor: String(suites.length), tono: 'acento' },
    { etiqueta: 'Pruebas', valor: String(total), tono: 'acento' },
    { etiqueta: 'Correctas', valor: String(correctas), tono: 'ok' },
    { etiqueta: 'Fallidas', valor: String(fallidas), tono: fallidas === 0 ? 'ok' : 'fallo' },
    { etiqueta: 'Duracion', valor: `${(msTotal / 1000).toFixed(2)} s`, tono: 'acento' },
    {
      etiqueta: 'Lineas cubiertas',
      valor: cobertura ? `${cobertura.total.lines.pct} %` : 'n/d',
      tono: 'acento',
    },
  ],
  secciones: [
    `<h2>Resultado por suite</h2>`,
    tabla({
      columnas: ['Archivo de pruebas', 'Pruebas', 'Estado'],
      filas: suites.map((s) => [
        `<span class="mono">${escapar(s.archivo)}</span>`,
        String(s.pruebas.length),
        `<span class="pastilla ${s.estado === 'passed' ? 'ok' : 'fallo'}">${s.estado === 'passed' ? 'PASS' : 'FAIL'}</span>`,
      ]),
    }),
    `<h2>Detalle de las pruebas</h2>`,
    tabla({
      columnas: ['Prueba', 'Resultado', 'Tiempo'],
      filas: suites.flatMap((s) =>
        s.pruebas.map((p) => [
          `<span class="mono">${escapar(p.nombre)}</span>`,
          `<span class="pastilla ${p.estado === 'passed' ? 'ok' : 'fallo'}">${p.estado === 'passed' ? 'OK' : 'FALLO'}</span>`,
          `${p.ms} ms`,
        ]),
      ),
    }),
    cobertura
      ? `<h2>Cobertura de los componentes</h2>
        <p class="subtitulo">Porcentaje de lineas, ramas, funciones y sentencias cubiertas por las pruebas.</p>
        ${tabla({
          columnas: ['Archivo', 'Lineas', 'Ramas', 'Funciones', 'Sentencias'],
          filas: archivosCobertura.map((a) => [
            `<span class="mono">${escapar(a.archivo)}</span>`,
            barra(a.lineas),
            barra(a.ramas),
            barra(a.funciones),
            barra(a.sentencias),
          ]),
        })}`
      : '',
    `<div class="nota"><b>Que se prueba:</b> que el componente muestre lo que recibe, que dispare sus eventos, que respete los estados deshabilitado y de carga, y que aplique las variantes de tamano y color. No se prueba el texto interno de React Native ni las animaciones.</div>`,
  ],
});

writeFileSync(join(carpeta, 'index.html'), html, 'utf8');
console.log(`Reporte: ${join(carpeta, 'index.html')}`);
console.log(`${correctas}/${total} pruebas de componente`);
if (!todoOk) process.exit(1);
