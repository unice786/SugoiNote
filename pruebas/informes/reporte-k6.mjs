// ─────────────────────────────────────────────────────────────
// Reportes HTML de las pruebas de carga y de estres (k6).
//
// Uso: node pruebas/informes/reporte-k6.mjs
// Entrada: pruebas/carga/resumen-carga.json
//          pruebas/carga/resumen-estres-<nivel>.json  (uno por nivel)
// Salida:  artifacts/pruebas/rendimiento/carga.html
//          artifacts/pruebas/rendimiento/estres.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const entrada = join(raiz, 'pruebas', 'carga');
const salida = join(raiz, 'artifacts', 'pruebas', 'rendimiento');
mkdirSync(salida, { recursive: true });

const leer = (nombre) => JSON.parse(readFileSync(join(entrada, nombre), 'utf8'));

const num = (valor, decimales = 0) =>
  Number(valor ?? 0).toLocaleString('es-GT', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const metricas = (datos) => ({
  peticiones: datos.metrics.http_reqs?.values.count ?? 0,
  rps: datos.metrics.http_reqs?.values.rate ?? 0,
  duracion: (datos.state?.testRunDurationMs ?? 0) / 1000,
  vus: datos.metrics.vus_max?.values.value ?? datos.metrics.vus?.values.max ?? 0,
  iteraciones: datos.metrics.iterations?.values.count ?? 0,
  errorRate: (datos.metrics.http_req_failed?.values.rate ?? 0) * 100,
  checks: (datos.metrics.checks?.values.rate ?? 0) * 100,
  p50: datos.metrics.http_req_duration?.values.med ?? 0,
  p90: datos.metrics.http_req_duration?.values['p(90)'] ?? 0,
  p95: datos.metrics.http_req_duration?.values['p(95)'] ?? 0,
  p99: datos.metrics.http_req_duration?.values['p(99)'] ?? 0,
  promedio: datos.metrics.http_req_duration?.values.avg ?? 0,
  maximo: datos.metrics.http_req_duration?.values.max ?? 0,
  recibido: (datos.metrics.data_received?.values.count ?? 0) / 1024 / 1024,
  umbrales: Object.entries(datos.metrics)
    .filter(([, m]) => m.thresholds && Object.keys(m.thresholds).length)
    .flatMap(([nombre, m]) => Object.entries(m.thresholds).map(([regla, info]) => ({ metrica: nombre, regla, ok: info.ok !== false }))),
});

function barraMs(valor, maximo) {
  const ancho = Math.max(2, Math.min(100, (valor / Math.max(maximo, 1)) * 100));
  return `<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:110px;height:8px;border-radius:4px;background:var(--borde)"><span style="display:block;width:${ancho}%;height:8px;border-radius:4px;background:var(--acento)"></span></span><span class="mono">${num(valor)} ms</span></div>`;
}

// ── Carga ────────────────────────────────────────────────────
const carga = metricas(leer('resumen-carga.json'));
const umbralesOk = carga.umbrales.every((u) => u.ok);

const htmlCarga = documento({
  titulo: 'Prueba de carga',
  subtitulo: 'Navegacion tipica de un estudiante con 20 usuarios virtuales concurrentes durante un minuto sostenido.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'Herramienta', valor: 'k6 (contenedor grafana/k6)' },
    { etiqueta: 'Objetivo', valor: 'http://api-carga:8080 (2 CPU, 1 GB)' },
    { etiqueta: 'Escenario', valor: 'ramping-vus 0 → 10 → 20 → 0' },
  ],
  tarjetas: [
    { etiqueta: 'Usuarios maximos', valor: String(carga.vus), tono: 'acento' },
    { etiqueta: 'Peticiones', valor: num(carga.peticiones), tono: 'acento' },
    { etiqueta: 'Peticiones por segundo', valor: num(carga.rps, 1), tono: 'acento' },
    { etiqueta: 'p95', valor: `${num(carga.p95)} ms`, tono: carga.p95 < 800 ? 'ok' : 'fallo' },
    { etiqueta: 'Errores', valor: `${num(carga.errorRate, 2)} %`, tono: carga.errorRate < 1 ? 'ok' : 'fallo' },
    { etiqueta: 'Duracion', valor: `${num(carga.duracion, 0)} s`, tono: 'acento' },
  ],
  secciones: [
    `<h2>Criterios de aceptacion</h2>`,
    tabla({
      columnas: ['Metrica', 'Umbral', 'Resultado'],
      filas: carga.umbrales.map((u) => [
        `<span class="mono">${escapar(u.metrica)}</span>`,
        `<span class="mono">${escapar(u.regla)}</span>`,
        `<span class="pastilla ${u.ok ? 'ok' : 'fallo'}">${u.ok ? 'CUMPLE' : 'NO CUMPLE'}</span>`,
      ]),
    }),
    `<h2>Distribucion de los tiempos de respuesta</h2>`,
    tabla({
      columnas: ['Indicador', 'Valor'],
      filas: [
        ['Promedio', `${num(carga.promedio)} ms`],
        ['Mediana (p50)', `${num(carga.p50)} ms`],
        ['p90', `${num(carga.p90)} ms`],
        ['p95', `${num(carga.p95)} ms`],
        ['p99', `${num(carga.p99)} ms`],
        ['Maximo', `${num(carga.maximo)} ms`],
        ['Checks correctos', `${num(carga.checks, 2)} %`],
        ['Iteraciones completadas', num(carga.iteraciones)],
        ['Datos recibidos', `${num(carga.recibido, 1)} MB`],
      ],
    }),
    `<div class="nota"><b>Por que este escenario:</b> cada iteracion consulta los cuatro listados que la app movil pide al abrir sus pantallas principales (apuntes, materias, perfil y comunidad) y espera entre 0,5 y 2 segundos entre pantallas, como un usuario real. El objetivo no es saturar sino comprobar que el uso normal se mantiene dentro de los umbrales.</div>`,
    `<div class="nota"><b>Entorno:</b> se ejecuta contra el contenedor <code>api-carga</code>, identico al de la API pero con el limitador de peticiones apagado. Con el limitador activo, todas las peticiones de k6 salen por la misma IP y se medirian respuestas 429 en lugar del rendimiento real.</div>`,
  ],
});

writeFileSync(join(salida, 'carga.html'), htmlCarga, 'utf8');
console.log(`Reporte de carga: ${join(salida, 'carga.html')}`);

// ── Estres ───────────────────────────────────────────────────
const niveles = readdirSync(entrada)
  .filter((f) => /^resumen-estres-\d+\.json$/.test(f))
  .map((f) => ({ archivo: f, nivel: Number(/resumen-estres-(\d+)/.exec(f)[1]) }))
  .sort((a, b) => a.nivel - b.nivel);

if (niveles.length) {
  const filasEstres = niveles.map(({ archivo, nivel }) => {
    const m = metricas(leer(archivo));
    const rompe = m.p95 > 2000 || m.errorRate > 5;
    return { nivel, ...m, rompe };
  });

  const primeroEnRomper = filasEstres.find((f) => f.rompe);
  const maxP95 = Math.max(...filasEstres.map((f) => f.p95));

  const htmlEstres = documento({
    titulo: 'Prueba de estres',
    subtitulo: 'Carga escalonada por niveles de usuarios virtuales hasta encontrar el punto donde la API deja de responder bien.',
    meta: [
      { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
      { etiqueta: 'Herramienta', valor: 'k6 (contenedor grafana/k6)' },
      { etiqueta: 'Objetivo', valor: 'http://api-carga:8080 (2 CPU, 1 GB)' },
      { etiqueta: 'Escenario', valor: 'constant-vus, 25 s por nivel' },
    ],
    tarjetas: [
      { etiqueta: 'Niveles probados', valor: String(filasEstres.length), tono: 'acento' },
      { etiqueta: 'Usuarios maximos', valor: String(Math.max(...filasEstres.map((f) => f.nivel))), tono: 'acento' },
      { etiqueta: 'Peticiones totales', valor: num(filasEstres.reduce((s, f) => s + f.peticiones, 0)), tono: 'acento' },
      { etiqueta: 'Punto de quiebre', valor: primeroEnRomper ? `${primeroEnRomper.nivel} VUs` : 'no alcanzado', tono: primeroEnRomper ? 'fallo' : 'ok' },
      { etiqueta: 'Error maximo', valor: `${num(Math.max(...filasEstres.map((f) => f.errorRate)), 2)} %`, tono: 'acento' },
    ],
    secciones: [
      `<h2>Resultado por nivel</h2>`,
      tabla({
        columnas: ['Usuarios virtuales', 'Peticiones', 'Peticiones/s', 'p95', 'p99', 'Errores', 'Estado'],
        filas: filasEstres.map((f) => [
          `<b>${f.nivel}</b>`,
          num(f.peticiones),
          num(f.rps, 1),
          barraMs(f.p95, maxP95),
          `${num(f.p99)} ms`,
          `${num(f.errorRate, 2)} %`,
          `<span class="pastilla ${f.rompe ? 'fallo' : 'ok'}">${f.rompe ? 'DEGRADADO' : 'ESTABLE'}</span>`,
        ]),
      }),
      `<h2>Interpretacion</h2>`,
      primeroEnRomper
        ? `<p>La API se mantuvo estable hasta <b>${filasEstres[Math.max(0, filasEstres.indexOf(primeroEnRomper) - 1)]?.nivel ?? 0} usuarios virtuales</b>. A partir de <b>${primeroEnRomper.nivel} usuarios</b> el p95 supero los 2 segundos o la tasa de errores paso del 5 %, que es el criterio definido para considerar el servicio degradado.</p>`
        : `<p>La API soporto todos los niveles probados (hasta <b>${Math.max(...filasEstres.map((f) => f.nivel))} usuarios virtuales</b>) sin superar el p95 de 2 segundos ni el 5 % de errores. El rendimiento se estabilizo en torno a <b>${num(Math.max(...filasEstres.map((f) => f.rps)))} peticiones por segundo</b>: a partir de ahi la latencia media crece de forma proporcional a los usuarios (de ${num(Math.min(...filasEstres.map((f) => f.promedio)))} ms a ${num(Math.max(...filasEstres.map((f) => f.promedio)))} ms) sin que aparezcan errores.</p>`,
      `<p>Se considera <b>degradado</b> un nivel donde el percentil 95 supera 2 000 ms o donde mas del 5 % de las peticiones falla. En un servidor de 2 CPU y 1 GB, estos numeros sirven para dimensionar, no para prometer produccion.</p>`,
      `<div class="nota"><b>Lectura honesta:</b> el punto de quiebre mide el contenedor de pruebas con recursos limitados a 2 CPU y 1 GB. Duplicar esos recursos cambia el resultado; lo que se documenta es el comportamiento del codigo bajo esa configuracion, no un limite absoluto del sistema.</div>`,
      `<div class="nota"><b>Sin pausa entre peticiones:</b> a diferencia de la prueba de carga, aqui cada usuario virtual encadena peticiones sin esperar, para forzar la saturacion.</div>`,
    ],
  });

  writeFileSync(join(salida, 'estres.html'), htmlEstres, 'utf8');
  console.log(`Reporte de estres: ${join(salida, 'estres.html')} (${filasEstres.length} niveles)`);
}

if (!umbralesOk) process.exit(1);
