// ─────────────────────────────────────────────────────────────
// Reporte HTML de los escaneos de seguridad (OWASP ZAP).
//
// Uso: node pruebas/informes/reporte-zap.mjs
// Entrada: artifacts/pruebas/seguridad/zap-baseline.json
//          artifacts/pruebas/seguridad/zap-api.json
// Salida:  artifacts/pruebas/seguridad/index.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const carpeta = join(raiz, 'artifacts', 'pruebas', 'seguridad');

function leer(nombre) {
  const ruta = join(carpeta, nombre);
  if (!existsSync(ruta)) return null;
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

function normalizar(datos, origen) {
  if (!datos) return [];
  const sitioDe = (texto) => {
    const t = (texto ?? '').toLowerCase();
    if (t.startsWith('high') || t.startsWith('alt')) return 'Alto';
    if (t.startsWith('medium') || t.startsWith('med')) return 'Medio';
    if (t.startsWith('low') || t.startsWith('baj')) return 'Bajo';
    return 'Informativo';
  };
  const sitios = datos.site ?? [];
  const alertas = [];
  for (const sitio of sitios) {
    for (const a of sitio.alerts ?? []) {
      alertas.push({
        origen,
        nombre: a.name ?? a.alert ?? 'Sin nombre',
        riesgo: sitioDe(a.riskdesc ?? a.risk),
        confianza: a.confidence ?? '',
        descripcion: (a.desc ?? '').replace(/<[^>]+>/g, '').trim(),
        solucion: (a.solution ?? '').replace(/<[^>]+>/g, '').trim(),
        cwe: a.cweid ?? '',
        instancias: (a.instances ?? []).map((i) => ({
          uri: i.uri ?? '',
          metodo: i.method ?? '',
          evidencia: (i.evidence ?? '').slice(0, 120),
        })),
      });
    }
  }
  return alertas;
}

const alertas = [
  ...normalizar(leer('zap-baseline.json'), 'Escaneo pasivo del sitio'),
  ...normalizar(leer('zap-api.json'), 'Escaneo activo de la API'),
];

const riesgos = ['Alto', 'Medio', 'Bajo', 'Informativo'];
const contar = (riesgo) => alertas.filter((a) => a.riesgo.toLowerCase().startsWith(riesgo.toLowerCase().slice(0, 3))).length;

const alto = contar('Alto');
const medio = contar('Medio');
const bajo = contar('Bajo');
const info = alertas.length - alto - medio - bajo;

const peso = { alto: 0, medio: 1, bajo: 2, informativo: 3 };
const ordenar = (a) => peso[a.riesgo.toLowerCase()] ?? 4;
const alertasOrdenadas = alertas.slice().sort((a, b) => ordenar(a) - ordenar(b));

const color = (riesgo) => {
  const r = riesgo.toLowerCase();
  if (r.startsWith('alt')) return 'fallo';
  if (r.startsWith('med')) return 'aviso';
  if (r.startsWith('baj')) return 'neutra';
  return 'neutra';
};

const resumenHallazgos = alertasOrdenadas
  .filter((a) => !a.riesgo.toLowerCase().startsWith('info'))
  .map((a) => `${a.nombre} (${a.riesgo.toLowerCase()})`)
  .filter((v, i, arr) => arr.indexOf(v) === i);

const html = documento({
  titulo: 'Pruebas de seguridad (OWASP ZAP)',
  subtitulo: 'Escaneo pasivo del sitio web y escaneo activo de la API documentada en OpenAPI.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'Herramienta', valor: 'OWASP ZAP (imagen oficial, en Docker)' },
    { etiqueta: 'Objetivo', valor: 'http://api:8080' },
    { etiqueta: 'Modalidad', valor: 'zap-baseline.py + zap-api-scan.py (OpenAPI)' },
  ],
  tarjetas: [
    { etiqueta: 'Riesgo alto', valor: String(alto), tono: alto ? 'fallo' : 'ok' },
    { etiqueta: 'Riesgo medio', valor: String(medio), tono: medio ? 'aviso' : 'ok' },
    { etiqueta: 'Riesgo bajo', valor: String(bajo), tono: 'neutra' },
    { etiqueta: 'Informativos', valor: String(info), tono: 'neutra' },
  ],
  secciones: [
    `<h2>Hallazgos</h2>`,
    alertas.length
      ? tabla({
          columnas: ['Riesgo', 'Hallazgo', 'Origen', 'Instancias'],
          filas: alertasOrdenadas.map((a) => [
            `<span class="pastilla ${color(a.riesgo)}">${escapar(a.riesgo)}</span>`,
            escapar(a.nombre),
            escapar(a.origen),
            String(a.instancias.length),
          ]),
        })
      : `<div class="nota">El escaneo no devolvio hallazgos.</div>`,
    `<h2>Detalle y recomendacion</h2>`,
    ...alertasOrdenadas.map(
      (a) => `
      <div class="flujo evitar-corte">
        <div class="cabecera">
          <span class="nombre">${escapar(a.nombre)}</span>
          <span class="pastilla ${color(a.riesgo)}">${escapar(a.riesgo)}</span>
        </div>
        <p class="subtitulo">${escapar(a.descripcion).slice(0, 420)}</p>
        ${
          a.instancias.length
            ? `<ul>${a.instancias
                .slice(0, 6)
                .map((i) => `<li class="mono">${escapar(i.metodo)} ${escapar(i.uri)}</li>`)
                .join('')}${a.instancias.length > 6 ? `<li>y ${a.instancias.length - 6} mas…</li>` : ''}</ul>`
            : ''
        }
        ${a.solucion ? `<p><b>Recomendacion:</b> ${escapar(a.solucion).slice(0, 400)}</p>` : ''}
      </div>`,
    ),
    `<h2>Lectura de los resultados</h2>`,
    `<div class="nota"><b>Escaneo pasivo:</b> revisa cabeceras, cookies y fuga de informacion sin atacar la aplicacion. <b>Escaneo activo:</b> envia cargas maliciosas a cada endpoint del OpenAPI (inyeccion SQL, XSS, comandos, rutas) autenticado con un token real.</div>`,
    `<div class="nota"><b>Contexto:</b> el entorno de pruebas corre sobre HTTP porque el certificado TLS lo termina un proxy en produccion. Por eso las alertas sobre HSTS y transporte seguro se evaluan como configuracion del entorno, no como defecto del codigo.</div>`,
    resumenHallazgos.length
      ? `<div class="nota"><b>Hallazgos que requieren accion:</b> ${escapar(resumenHallazgos.slice(0, 8).join('; '))}${resumenHallazgos.length > 8 ? '…' : ''}.</div>`
      : '',
  ],
});

writeFileSync(join(carpeta, 'index.html'), html, 'utf8');
console.log(`Reporte: ${join(carpeta, 'index.html')}`);
console.log(`alto=${alto} medio=${medio} bajo=${bajo} informativos=${info}`);
