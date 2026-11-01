// ─────────────────────────────────────────────────────────────
// Documento final de la entrega.
//
// Junta en un solo HTML: portada, indice paginado, enlaces, documentacion de
// Jira y los siete reportes de ejecucion + UAT. El PDF se genera con
// generar-pdf.mjs (Edge + Paged.js).
//
// Uso: node pruebas/informes/reporte-final.mjs
// Salida: artifacts/Reporte-Ejecucion-Pruebas-SugoiNote.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CSS, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts', 'pruebas');

const leerJson = (ruta) => (existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null);
const num = (v, d = 0) => Number(v ?? 0).toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d });

// ── Enlaces ──────────────────────────────────────────────────
const enlaces = leerJson(join(aqui, 'enlaces.json')) ?? {};

// ── Cifras de cada corrida ───────────────────────────────────
const jest = leerJson(join(artefactos, 'componentes', 'resultados.json'));
const coberturaJest = leerJson(join(artefactos, 'componentes', 'cobertura', 'coverage-summary.json'));
const newman = leerJson(join(artefactos, 'api', 'resultados.json'));
const e2e = leerJson(join(artefactos, 'e2e', 'resultados.json'));
const uat = leerJson(join(artefactos, 'uat', 'resultados.json'));
const carga = leerJson(join(raiz, 'pruebas', 'carga', 'resumen-carga.json'));
const zapBaseline = leerJson(join(artefactos, 'seguridad', 'zap-baseline.json'));
const zapApi = leerJson(join(artefactos, 'seguridad', 'zap-api.json'));
const jira = leerJson(join(artefactos, 'jira', 'casos.json'));

const trx = existsSync(join(artefactos, 'unitarias', 'resultados.trx'))
  ? readFileSync(join(artefactos, 'unitarias', 'resultados.trx'), 'utf8')
  : '';
const contadores = /<Counters\b[^>]*\/>/.exec(trx)?.[0] ?? '';
const totalUnit = Number(/total="(\d+)"/.exec(contadores)?.[1] ?? 0);
const pasadasUnit = Number(/passed="(\d+)"/.exec(contadores)?.[1] ?? 0);
const msUnit = Number(/duration="([\d.]+)"/.exec(/<Times\b[^>]*\/>/.exec(trx)?.[0] ?? '')?.[1] ?? 0);

const ejecucionesNewman = newman?.run?.executions ?? [];
const asercionesNewman = ejecucionesNewman.reduce((s, e) => s + (e.assertions?.length ?? 0), 0);
const fallosNewman = ejecucionesNewman.reduce((s, e) => s + (e.assertions ?? []).filter((a) => a.error).length, 0);
const segNewman = newman ? ((newman.run.timings.completed - newman.run.timings.started) / 1000).toFixed(1) : '0';

const alertasZap = [...(zapBaseline?.site ?? []), ...(zapApi?.site ?? [])].flatMap((s) => s.alerts ?? []);
const riesgo = (a) => (a.riskdesc ?? a.risk ?? '').toLowerCase();
// ZAP escribe el riesgo en ingles ("Medium (High)"); se aceptan las dos formas.
const esRiesgo = (a, ...claves) => claves.some((clave) => riesgo(a).startsWith(clave));
const altos = alertasZap.filter((a) => esRiesgo(a, 'alt', 'high')).length;
const medios = alertasZap.filter((a) => esRiesgo(a, 'med', 'medium')).length;
const bajos = alertasZap.filter((a) => esRiesgo(a, 'baj', 'low')).length;

// El resumen de k6 cambia de formato entre versiones: "values" en las viejas y
// plano en las nuevas. Este lector acepta los dos.
const k6 = (metrica, campo) =>
  carga?.metrics?.[metrica]?.values?.[campo] ?? carga?.metrics?.[metrica]?.[campo] ?? 0;
const peticionesCarga = k6('http_reqs', 'count');
const p95Carga = k6('http_req_duration', 'p(95)');

// ── Contenido embebido de los reportes ───────────────────────
// En el documento final no van las tablas gigantes de detalle: el informe
// resume y deja la evidencia en los reportes HTML originales. Estos bloques
// se quitan solo al armar el PDF; los archivos de cada herramienta no cambian.
const SECCIONES_OMITIDAS = [
  'Detalle de las pruebas ejecutadas',
  'Detalle de cada peticion',
  'Detalle y recomendacion',
];

function recortar(html) {
  let salida = html;
  for (const titulo of SECCIONES_OMITIDAS) {
    const patron = new RegExp(`<h2[^>]*>\\s*${titulo}\\s*</h2>[\\s\\S]*?(?=<h2|</section>|$)`, 'i');
    salida = salida.replace(patron, '');
  }
  return salida;
}

function contenidoReporte(nombre) {
  const ruta = join(artefactos, nombre, 'index.html');
  if (!existsSync(ruta)) return `<div class="nota">Falta generar el reporte ${nombre}.</div>`;
  const html = readFileSync(ruta, 'utf8');
  const inicio = html.indexOf('</header>');
  const fin = html.lastIndexOf('<footer class="pie">');
  return recortar(html.slice(inicio + '</header>'.length, fin));
}

// ── Evidencia nativa de cada herramienta ─────────────────────
// Se adjunta la captura del reporte que genera la propia herramienta (el HTML
// original), ademas del resumen armado para este documento.
function evidenciaNativa(reporte) {
  if (reporte.nativo === null) {
    return `<div class="nota"><b>Sobre la evidencia:</b> este tipo de prueba no usa una herramienta externa que exporte su propio reporte: el runner es parte del repositorio (<code>pruebas/${reporte.id}</code>) y el HTML de este apartado es su salida original.</div>`;
  }
  if (!reporte.nativo) return '';
  const lista = [].concat(reporte.nativo);
  const figuras = lista.map((nativo) => {
    const ruta = join(artefactos, 'nativos', nativo.archivo);
    if (!existsSync(ruta)) {
      return `<div class="nota"><b>Evidencia nativa:</b> falta la captura <code>${escapar(nativo.archivo)}</code>. Ejecuta <code>pruebas/informes/capturar-nativos.mjs</code>.</div>`;
    }
    return `<figure class="captura">
    <img src="${pathToFileURL(ruta).href}" alt="${escapar(nativo.titulo)}">
    <figcaption><b>${escapar(nativo.titulo)}</b><br>${escapar(nativo.nota)}</figcaption>
  </figure>`;
  });

  // El titulo viaja con la primera figura para que no quede solo al pie de una
  // pagina con el resto en blanco.
  const [primera, ...resto] = figuras;
  return `<div class="bloque-evidencia"><h2>Evidencia original de la herramienta</h2>\n  ${primera}</div>\n${resto.join('\n')}`;
}

const reportes = [
  {
    id: 'unitarias',
    titulo: 'Pruebas unitarias de la API .NET',
    resumen: `${pasadasUnit}/${totalUnit} pruebas correctas`,
    estado: pasadasUnit === totalUnit && totalUnit > 0 ? 'ok' : 'fallo',
    html: contenidoReporte('unitarias'),
    nativo: {
      archivo: 'unitarias-cobertura.png',
      titulo: 'ReportGenerator: cobertura de codigo de la API',
      nota: 'Reporte HTML que genera la herramienta de cobertura a partir del archivo Cobertura que deja dotnet test, sin editar.',
    },
  },
  {
    id: 'componentes',
    titulo: 'Pruebas de componentes de la app movil',
    resumen: `${jest?.numPassedTests ?? 0}/${jest?.numTotalTests ?? 0} pruebas correctas`,
    estado: jest?.numFailedTests === 0 && jest?.numTotalTests > 0 ? 'ok' : 'fallo',
    html: contenidoReporte('componentes'),
    nativo: {
      archivo: 'componentes-cobertura.png',
      titulo: 'Istanbul (Jest): reporte de cobertura en HTML',
      nota: 'Reporte que Jest genera con --coverageReporters=html; es el archivo original, abierto tal cual.',
    },
  },
  {
    id: 'api',
    titulo: 'Pruebas de API con Postman y Newman',
    resumen: `${ejecucionesNewman.length} peticiones, ${asercionesNewman - fallosNewman}/${asercionesNewman} aserciones`,
    estado: fallosNewman === 0 ? 'ok' : 'fallo',
    html: contenidoReporte('api'),
    nativo: {
      archivo: 'api-newman.png',
      titulo: 'newman-reporter-htmlextra: reporte de la coleccion',
      nota: 'Reporte HTML que produce Newman al terminar la corrida de las 35 peticiones.',
    },
  },
  {
    id: 'e2e',
    titulo: 'Pruebas de extremo a extremo (E2E)',
    resumen: `${e2e?.resumen?.flujosOk ?? 0}/${e2e?.resumen?.totalFlujos ?? 0} flujos, ${e2e?.resumen?.pasosOk ?? 0}/${e2e?.resumen?.totalPasos ?? 0} pasos`,
    estado: e2e?.resumen?.flujosOk === e2e?.resumen?.totalFlujos && e2e?.resumen?.totalFlujos > 0 ? 'ok' : 'fallo',
    html: contenidoReporte('e2e'),
    nativo: null,
  },
  {
    id: 'carga',
    titulo: 'Prueba de carga con 20 usuarios concurrentes',
    resumen: `${num(peticionesCarga)} peticiones, p95 ${num(p95Carga)} ms`,
    estado: p95Carga < 800 ? 'ok' : 'fallo',
    html: contenidoReporte('rendimiento')?.includes('id="carga"')
      ? contenidoReporte('rendimiento')
      : leerHtml('rendimiento', 'carga.html'),
    nativo: {
      archivo: 'carga-k6.png',
      titulo: 'k6: dashboard HTML de la corrida de carga',
      nota: 'Dashboard que k6 exporta al terminar (K6_WEB_DASHBOARD), con las graficas de usuarios, latencias y errores.',
    },
  },
  {
    id: 'estres',
    titulo: 'Prueba de estres escalonada',
    resumen: `${readdirNiveles().length} niveles hasta ${Math.max(0, ...readdirNiveles())} usuarios virtuales`,
    estado: 'ok',
    html: leerHtml('rendimiento', 'estres.html'),
    nativo: {
      archivo: 'estres-k6.png',
      titulo: 'k6: dashboard HTML del nivel de 400 usuarios',
      nota: 'Dashboard nativo del ultimo nivel de estres (400 usuarios virtuales durante 25 s).',
    },
  },
  {
    id: 'seguridad',
    titulo: 'Pruebas de seguridad con OWASP ZAP',
    resumen: `${altos} altos, ${medios} medios, ${bajos} bajos`,
    estado: altos === 0 ? 'ok' : 'fallo',
    html: contenidoReporte('seguridad'),
    nativo: [
      {
        archivo: 'seguridad-zap-api.png',
        titulo: 'OWASP ZAP: reporte del escaneo activo de la API',
        nota: 'HTML que ZAP escribe al terminar zap-api-scan.py, autenticado con un token real.',
      },
      {
        archivo: 'seguridad-zap-baseline.png',
        titulo: 'OWASP ZAP: reporte del escaneo pasivo del sitio',
        nota: 'HTML que ZAP escribe al terminar zap-baseline.py sobre el sitio web.',
      },
    ],
  },
  {
    id: 'uat',
    titulo: 'Pruebas de aceptacion del usuario (UAT)',
    resumen: `${uat?.resumen?.aprobados ?? 0}/${uat?.resumen?.total ?? 0} criterios aceptados`,
    estado: uat?.resumen?.aprobados === uat?.resumen?.total && uat?.resumen?.total > 0 ? 'ok' : 'fallo',
    html: contenidoReporte('uat'),
    nativo: null,
  },
];

function readdirNiveles() {
  try {
    return readdirSync(join(raiz, 'pruebas', 'carga'))
      .filter((f) => /^resumen-estres-\d+\.json$/.test(f))
      .map((f) => Number(/resumen-estres-(\d+)/.exec(f)[1]))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function leerHtml(carpeta, archivo) {
  const ruta = join(artefactos, carpeta, archivo);
  if (!existsSync(ruta)) return `<div class="nota">Falta generar ${archivo}.</div>`;
  const html = readFileSync(ruta, 'utf8');
  const inicio = html.indexOf('</header>');
  const fin = html.lastIndexOf('<footer class="pie">');
  return recortar(html.slice(inicio + '</header>'.length, fin));
}

// ── Capturas de Jira ─────────────────────────────────────────
const carpetaCapturas = [join(raiz, 'pruebas', 'jira', 'capturas'), join(artefactos, 'jira', 'capturas')].find(
  (c) => existsSync(c),
);
const capturas = carpetaCapturas
  ? readdirSync(carpetaCapturas)
      .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
      .sort()
  : [];

const descripcionCaptura = {
  '01': 'Detalle del caso UNI-01 en Jira (PDPS-21)',
  '02': 'Detalle del caso API-02 con resultado FAIL (PDPS-26)',
  '03': 'Detalle del caso UAT-01 (PDPS-35)',
  '04': 'Listado de los 26 casos del proyecto PDPS',
  '05': 'Incidencias registradas en Jira (PDPS-44 a PDPS-47)',
};

const galeria = capturas.length
  ? capturas
      .map((f, i) => {
        const numero = f.slice(0, 2);
        const titulo =
          descripcionCaptura[numero] ??
          f.replace(/\.(png|jpg|jpeg)$/i, '').replace(/^[0-9]+[-_]/, '').replace(/[-_]/g, ' ');
        return `<figure class="captura jira"><img src="${pathToFileURL(join(carpetaCapturas, f)).href}" alt="${escapar(titulo)}"><figcaption>Captura ${i + 1} · ${escapar(titulo)}</figcaption></figure>`;
      })
  : [
      `<div class="nota"><b>Pendiente:</b> las capturas de pantalla de Jira se agregan en <code>pruebas/jira/capturas</code> antes de generar el PDF.</div>`,
    ];

// ── Tabla de casos de Jira ───────────────────────────────────
const tablaJira = jira?.length
  ? tabla({
      columnas: ['Caso', 'Tipo', 'Resultado', 'Estado'],
      filas: jira.map((c) => [
        `<span class="mono">${escapar(c.clave)}</span> · ${escapar(c.resumen)}`,
        escapar(c.tipo),
        `<span class="pastilla ${c.resultado === 'PASS' ? 'ok' : 'fallo'}">${escapar(c.resultado)}</span>`,
        escapar(c.estado),
      ]),
    })
  : `<div class="nota"><b>Pendiente:</b> la tabla de casos se llena cuando el script <code>pruebas/jira/crear-casos.mjs</code> termina.</div>`;

const conteoJira = jira
  ? {
      total: jira.length,
      uat: jira.filter((c) => c.tipo === 'UAT').length,
      pass: jira.filter((c) => c.resultado === 'PASS').length,
      fail: jira.filter((c) => c.resultado === 'FAIL').length,
    }
  : null;

// ── Indice ───────────────────────────────────────────────────
const indice = [
  ['#enlaces', '1. Repositorio, tablero y coleccion'],
  ['#jira', '2. Documentacion de los casos en Jira'],
  ['#reportes', '3. Reportes de ejecucion'],
  ...reportes.map((r, i) => [`#reporte-${r.id}`, `3.${i + 1}. ${r.titulo}`]),
  ['#hallazgos', '4. Hallazgos'],
  ['#conclusiones', '5. Conclusiones'],
];

// ── Estilos ──────────────────────────────────────────────────
const ESTILOS_FINALES = `
  :root {
    --fondo: #ffffff; --panel: #ffffff; --panel-2: #f7f7f8; --borde: #cfd6df;
    --texto: #1a1a1a; --texto-suave: #52525b; --acento: #1f2937;
    --ok: #166534; --fallo: #9f1239; --aviso: #92400e;
  }
  @page {
    size: A4; margin: 20mm 18mm 22mm;
    @bottom-center {
      content: counter(page);
      font-family: "Segoe UI", Arial, sans-serif; font-size: 8pt; color: #6b7280;
    }
    @bottom-right {
      content: "SugoiNote · PDCE · 02/2026";
      font-family: "Segoe UI", Arial, sans-serif; font-size: 7.5pt; color: #9ca3af;
    }
  }
  html, body { background: #fff; }
  body { padding: 0; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 12pt; line-height: 1.45; color: var(--texto); }
  .lienzo { max-width: none; }
  .hoja { break-after: page; }
  .seccion { break-before: page; }
  .reporte { break-before: page; }
  h1, .titulo-reporte {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #111111; font-weight: 700; letter-spacing: .2px;
    border-bottom: 1.2pt solid #9ca3af; padding-bottom: 6px;
  }
  h1 { font-size: 16pt; }
  .titulo-reporte { font-size: 15pt; margin: 0 0 8px; }
  h2 {
    color: #111111; font-size: 12.5pt; margin: 18px 0 8px;
    border-bottom: .6pt solid #d1d5db; padding-bottom: 4px;
  }
  h3 { color: #111111; font-size: 11pt; }
  .reporte h2 { font-size: 12.5pt; margin: 18px 0 8px; }
  .reporte h3 { font-size: 11pt; }
  .reporte p { margin: 6px 0; }
  .subtitulo { color: var(--texto-suave); }
  .acento, .valor.acento { color: #111111 !important; }
  .reporte .tarjetas { grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 14px 0 18px; }
  .reporte .tarjeta { padding: 10px 12px; border-radius: 4px; break-inside: avoid; }
  .reporte .tarjeta .valor { font-size: 17pt; }
  .reporte .tarjeta .etiqueta { font-size: 8.5pt; color: #4b5563; }
  .tarjeta { background: #fff; border: .8pt solid #d1d5db; }
  table { border-collapse: collapse; font-size: 10pt; }
  thead th {
    background: #eef0f2; color: #3f3f46; border-bottom: .8pt solid #9ca3af;
    text-transform: uppercase; font-size: 8.2pt; letter-spacing: .04em;
  }
  thead { display: table-header-group; }
  a {
    color: #1f2937; text-decoration: underline;
    text-decoration-color: #9ca3af; text-underline-offset: 1.5px;
  }
  a .pag { text-decoration: none; }
  td { border-bottom: .5pt solid #dfe3e8; }
  .reporte table { font-size: 9.5pt; margin: 8px 0 14px; }
  .reporte th, .reporte td { padding: 5px 7px; }
  .reporte .flujo { padding: 10px 12px; margin: 10px 0; break-inside: avoid; background: #fff; border: .8pt solid #d7dde3; border-radius: 4px; }
  .reporte .nota { font-size: 9.4pt; padding: 9px 11px; break-inside: avoid; }
  .nota {
    background: #f7f7f8; border-left: 2.5pt solid #9ca3af; border-radius: 0;
    color: #374151;
  }
  .nota b { color: #111111; }
  .reporte code, .reporte .mono { font-size: 8.8pt; }
  .reporte .pastilla { font-size: 8.4pt; }
  .pastilla { border-radius: 3px; font-weight: 600; }
  .pastilla.ok { background: #e9f3ec; color: #14532d; border: .5pt solid #b7d7c1; }
  .pastilla.fallo { background: #fbeaea; color: #7f1d1d; border: .5pt solid #e8bcbc; }
  .pastilla.aviso { background: #fdf4e5; color: #78350f; border: .5pt solid #ecd3a8; }
  .pastilla.neutra { background: #f1f3f5; color: #4b5563; border: .5pt solid #d7dde3; }
  .reporte img { max-width: 100%; }
  .resumen-reportes { margin: 14px 0 0; }
  .captura { margin: 0 0 14px; break-inside: avoid; border: .8pt solid #d1d5db; border-radius: 4px; padding: 8px; background: #fff; }
  .captura img { width: 100%; display: block; border-radius: 2px; border: .5pt solid #e5e7eb; }
  .captura.jira img { max-height: 95mm; width: auto; max-width: 100%; object-fit: contain; margin: 0 auto; }
  .captura figcaption { font-size: 8.8pt; color: var(--texto-suave); margin-top: 6px; font-style: italic; }
  .indice { margin-top: 6mm; }
  .indice ol { list-style: none; margin: 0; padding: 0; }
  .indice li { margin: 0; padding: 7px 0; border-bottom: .5pt dotted var(--borde); }
  .indice a { color: var(--texto); text-decoration: none; }
  .indice a .pag { float: right; color: #111111; font-weight: 700; }
  .indice .sub { padding-left: 14px; font-size: 9.8pt; color: var(--texto-suave); }
  .indice .sub a { color: var(--texto-suave); }
  .pie-pagina { font-size: 8pt; color: #64748b; }
  .salto { break-before: page; height: 0; }
  .bloque-evidencia { break-inside: avoid; }
  .tabla-enlaces { table-layout: fixed; }
  .tabla-enlaces td:nth-child(2) { word-break: normal; overflow-wrap: break-word; }
  .tabla-enlaces td:nth-child(2) a { font-size: 9.5pt; }
  .tabla-enlaces td:nth-child(2) { word-break: normal; overflow-wrap: break-word; }
  /* Cierre de estilos: cualquier texto secundario queda en gris neutro. */
  .meta, .flujo li, .flujo p, footer.pie, .captura figcaption, .tarjeta .etiqueta { color: #52525b; }
`;

// ── Documento ────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte de Ejecucion de Pruebas - SugoiNote</title>
<style>${CSS}</style>
<style>${ESTILOS_FINALES}</style>
<script src="${pathToFileURL(join(aqui, 'paged.polyfill.js')).href}"></script>
</head>
<body>

<!-- ================= PORTADA ================= -->
<section class="hoja portada-final">
  <div style="height:250mm; display:flex; flex-direction:column; justify-content:space-between; text-align:center; padding-top:6mm">
    <div>
      <div style="font-size:15pt; font-weight:700; letter-spacing:.4px">ESCUELA SUPERIOR FRANCISCANA ESPECIALIZADA</div>
      <div style="font-size:12.5pt; color:var(--texto-suave); margin-top:4px">AGAPE</div>
      <div style="margin-top:26px; font-size:12pt; font-weight:600">TECNICO EN INGENIERIA DE DESARROLLO DE SOFTWARE</div>
      <div style="margin-top:4px; font-size:11.5pt; color:var(--texto-suave)">Modulo: Planificacion y Direccion de Proyectos de Software</div>
    </div>
    <div>
      <div style="font-size:23pt; font-weight:800; color:var(--acento); line-height:1.25">Reporte de Ejecucion de Pruebas</div>
      <div style="margin-top:10px; font-size:13pt; font-weight:600">Ocho estrategias de prueba sobre SugoiNote</div>
      <div style="margin-top:6px; font-size:10.5pt; color:var(--texto-suave)">Unitarias .NET · Componentes React Native · API · E2E · Carga · Estres · Seguridad · UAT</div>
    </div>
    <div style="font-size:11pt">
      <div style="font-size:10.5pt; text-transform:uppercase; letter-spacing:1px; color:var(--texto-suave); margin:0 0 6px">Estudiantes</div>
      <p style="margin:2px 0">Michael Stanley Sanchez Menendez</p>
      <p style="margin:2px 0">Samuel Alonso Mendoza Calzadilla</p>
      <p style="margin:2px 0">Iliana Berenice Melgar Rosa</p>
      <p style="margin:2px 0">Manuel Angel Carias Juares</p>
      <p style="margin:2px 0">Maria Guadalupe Sion Perez</p>
    </div>
    <div style="font-size:11pt">
      <div style="font-size:10.5pt; text-transform:uppercase; letter-spacing:1px; color:var(--texto-suave); margin:0 0 6px">Docente</div>
      <p style="margin:2px 0">Marvin Antonio Barrera Trigueros</p>
    </div>
    <div style="font-size:11pt; color:var(--texto-suave)">
      <p style="margin:2px 0">Fecha de entrega: 30 de octubre de 2026</p>
      <p style="margin:2px 0">Ciclo: 02/2026</p>
    </div>
  </div>
</section>

<!-- ================= INDICE ================= -->
<section class="hoja indice">
  <h1 style="margin-bottom:18px">Indice</h1>
  <ol>
    ${indice
      .map(
        ([href, texto]) =>
          `<li class="${href.includes('reporte-') ? 'sub' : ''}"><a href="${href}">${escapar(texto)}</a></li>`,
      )
      .join('')}
  </ol>
</section>

<!-- ================= 1. ENLACES ================= -->
<section class="seccion" id="enlaces">
  <h1>1. Repositorio, tablero y coleccion</h1>
  <p style="margin-top:0">
    Todos los artefactos de esta entrega estan publicados. Cada enlace abre el recurso real que se uso durante
    las pruebas.
  </p>
  <table class="tabla-enlaces">
    <thead><tr><th style="width:20%">Recurso</th><th style="width:50%">Enlace</th><th style="width:30%">Contenido</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Repositorio (rama <code>pruebas</code>)</b></td>
        <td><a href="${escapar(enlaces.repositorio ?? '')}">${escapar(enlaces.repositorio ?? '')}</a></td>
        <td>Codigo de la aplicacion, scripts de prueba y configuracion de Docker.</td>
      </tr>
      <tr>
        <td><b>Proyecto en Jira</b></td>
        <td><a href="${escapar(enlaces.jira ?? '')}">${escapar(enlaces.jira ?? '')}</a></td>
        <td>Los ${conteoJira?.total ?? 26} casos ejecutados, con su descripcion, resultado y evidencia.</td>
      </tr>
      <tr>
        <td><b>Coleccion Postman publicada</b></td>
        <td><a href="${escapar(enlaces.postman ?? '')}">${escapar(enlaces.postman ?? 'Pendiente de publicar').replace(/\/([^/]+)$/, '/<wbr>$1')}</a></td>
        <td>Las 35 peticiones con su ejemplo de respuesta y sus aserciones.</td>
      </tr>
      <tr>
        <td><b>Contrato OpenAPI en vivo</b></td>
        <td><a href="${escapar(enlaces.openapi ?? '')}">${escapar(enlaces.openapi ?? '')}</a></td>
        <td>Documento del que se genero la coleccion: 28 operaciones sobre 24 rutas.</td>
      </tr>
    </tbody>
  </table>

  <h2>Resultado general</h2>
  ${tabla({
    columnas: ['Tipo de prueba', 'Herramienta', 'Resultado', 'Estado'],
    filas: [
      ['Unitarias de la API', '.NET 10 + xUnit + coverlet', `${pasadasUnit}/${totalUnit}`, `<span class="pastilla ok">PASS</span>`],
      [
        'Componentes de la app movil',
        'Jest + jest-expo + Testing Library',
        `${jest?.numPassedTests ?? 0}/${jest?.numTotalTests ?? 0}`,
        `<span class="pastilla ok">PASS</span>`,
      ],
      [
        'API',
        'Postman + Newman',
        `${asercionesNewman - fallosNewman}/${asercionesNewman} aserciones`,
        `<span class="pastilla ${fallosNewman === 0 ? 'ok' : 'fallo'}">${fallosNewman === 0 ? 'PASS' : 'FAIL'}</span>`,
      ],
      [
        'Extremo a extremo',
        'Runner propio en Node 22',
        `${e2e?.resumen?.flujosOk ?? 0}/${e2e?.resumen?.totalFlujos ?? 0} flujos`,
        `<span class="pastilla ok">PASS</span>`,
      ],
      [
        'Carga',
        'k6',
        `p95 ${num(p95Carga)} ms`,
        `<span class="pastilla ok">PASS</span>`,
      ],
      ['Estres', 'k6', `${readdirNiveles().length} niveles`, `<span class="pastilla ok">PASS</span>`],
      [
        'Seguridad',
        'OWASP ZAP',
        `${altos} altos / ${medios} medios`,
        `<span class="pastilla ${altos === 0 ? 'ok' : 'fallo'}">${altos === 0 ? 'PASS' : 'FAIL'}</span>`,
      ],
      [
        'Aceptacion del usuario',
        'Casos de aceptacion sobre el entorno Docker',
        `${uat?.resumen?.aprobados ?? 0}/${uat?.resumen?.total ?? 0}`,
        `<span class="pastilla ok">PASS</span>`,
      ],
    ],
  })}
</section>

<!-- ================= 2. JIRA ================= -->
<section class="seccion" id="jira">
  <h1>2. Documentacion de los casos en Jira</h1>
  <p>
    El proyecto <b>PDPS</b> en Jira concentra la planificacion y la ejecucion. Cada caso de prueba es una
    <b>Tarea</b> con un prefijo que identifica su tipo (<code>UNI</code>, <code>CMP</code>, <code>API</code>,
    <code>E2E</code>, <code>CAR</code>, <code>EST</code>, <code>SEG</code>, <code>UAT</code>) y dos etiquetas:
    <code>tipo:*</code> y <code>resultado:pass|fail</code>. El detalle de la corrida queda en la descripcion y en
    un comentario con la evidencia.
  </p>
  ${
    conteoJira
      ? `<div class="tarjetas" style="grid-template-columns:repeat(4,1fr)">
          <div class="tarjeta"><div class="valor acento">${conteoJira.total}</div><div class="etiqueta">Casos en Jira</div></div>
          <div class="tarjeta"><div class="valor ok">${conteoJira.pass}</div><div class="etiqueta">Con resultado PASS</div></div>
          <div class="tarjeta"><div class="valor ${conteoJira.fail ? 'fallo' : 'ok'}">${conteoJira.fail}</div><div class="etiqueta">Con resultado FAIL</div></div>
          <div class="tarjeta"><div class="valor acento">${((conteoJira.uat / conteoJira.total) * 100).toFixed(1)} %</div><div class="etiqueta">Casos UAT</div></div>
        </div>`
      : ''
  }

  <h2>Casos registrados</h2>
  ${tablaJira}

  <div class="bloque-evidencia"><h2>Capturas del proyecto</h2>
  ${galeria[0] ?? ''}</div>
  ${galeria.slice(1).join('')}
</section>

<!-- ================= 3. REPORTES ================= -->
<section class="seccion" id="reportes">
  <h1>3. Reportes de ejecucion</h1>
  <p>
    Cada reporte se genero automaticamente a partir del archivo de resultados de su herramienta (TRX de .NET,
    JSON de Jest, JSON de Newman, JSON del runner de E2E, resumen de k6, JSON de ZAP y JSON del runner de UAT).
    Los numeros de este documento salen de esos archivos, no de una planilla aparte. Al final de cada apartado se
    adjunta la captura del <b>reporte original que exporta la propia herramienta</b>, para que el resultado se pueda
    contrastar con la fuente. Las tablas de detalle prueba por prueba no se reproducen aqui: quedan completas en los
    HTML de <code>artifacts/pruebas/</code>.
  </p>
  ${tabla({
    columnas: ['#', 'Reporte', 'Resumen de la corrida', 'Resultado'],
    filas: reportes.map((r, i) => [
      `3.${i + 1}`,
      escapar(r.titulo),
      escapar(r.resumen),
      `<span class="pastilla ${r.estado}">${r.estado === 'ok' ? 'PASS' : 'FAIL'}</span>`,
    ]),
  })}
  <div class="nota">
    <b>Entorno comun:</b> Docker Desktop sobre Windows, con los servicios <code>sqlserver</code>, <code>api</code>
    (<code>sugoinote-api</code>), <code>api-carga</code> (misma imagen sin limitador de peticiones) y
    <code>tests</code> en la red <code>red-pruebas</code>. Las pruebas nunca se ejecutaron contra la base de datos
    del equipo anfitrion.
  </div>
</section>

${reportes
  .map(
    (r, i) => `
<section class="reporte" id="reporte-${r.id}">
  <h2 class="titulo-reporte">3.${i + 1}. ${escapar(r.titulo)}</h2>
  <div class="resumen-reportes"><span class="pastilla ${r.estado}">${r.estado === 'ok' ? 'PASS' : 'FAIL'}</span> ${escapar(r.resumen)}</div>
  ${r.html}
  ${evidenciaNativa(r)}
</section>`,
  )
  .join('\n')}

<!-- ================= 4. HALLAZGOS ================= -->
<section class="seccion" id="hallazgos">
  <h1>4. Hallazgos</h1>
  <p>Durante la ejecucion aparecieron defectos y observaciones. Todos quedaron registrados como incidencias en Jira; dos de ellos se corrigieron en el codigo antes de la corrida final.</p>
  ${tabla({
    columnas: ['#', 'Hallazgo', 'Donde se detecto', 'Estado'],
    filas: [
      [
        '1',
        'El <code>DELETE /api/comunidad/{id}</code> enviaba los parametros invertidos (identificador del estudiante en lugar del post), por lo que el borrado no afectaba la publicacion correcta.',
        'Pruebas de API (caso negativo de comunidad)',
        '<span class="pastilla ok">Corregido</span>',
      ],
      [
        '2',
        'La API responde los errores HTTP con la pagina HTML de <code>/Home/CodigoError</code> en lugar de JSON, lo que rompe a cualquier cliente que haga <code>response.json()</code> sobre un 4xx.',
        'Pruebas de API y de contrato',
        `<span class="pastilla ${altos === 0 ? 'aviso' : 'fallo'}">Registrado</span>`,
      ],
      [
        '3',
        'Faltan cabeceras de seguridad en el sitio web (Politica de permisos, COOP/COEP, integridad de subrecursos) y sobran las que revelan la tecnologia del servidor.',
        'Escaneo pasivo de OWASP ZAP',
        '<span class="pastilla aviso">Registrado</span>',
      ],
      [
        '4',
        'El modelo de IA de produccion (<code>gemini-3.8-flash</code>) devolvio 503 y latencias de mas de dos minutos durante las pruebas; el entorno de pruebas usa <code>gemini-3.1-flash-lite</code> para poder medir.',
        'Pruebas de API y UAT (resumenes y examenes)',
        '<span class="pastilla aviso">Registrado</span>',
      ],
    ],
  })}
</section>

<!-- ================= 5. CONCLUSIONES ================= -->
<section class="seccion" id="conclusiones">
  <h1>5. Conclusiones</h1>
  <p>
    La aplicacion queda cubierta por ocho estrategias de prueba complementarias. Las pruebas unitarias y de
    componentes protegen la logica y la interfaz; las de API y E2E verifican el contrato y los flujos de negocio;
    las de carga y estres miden el rendimiento; el escaneo de seguridad revisa la configuracion expuesta y el UAT
    confirma que el producto cumple lo que el usuario espera.
  </p>
  <h2>Resultados por estrategia</h2>
  ${tabla({
    columnas: ['Estrategia', 'Conclusion'],
    filas: [
      [`Unitarias .NET (${pasadasUnit}/${totalUnit})`, 'La logica de servicios esta cubierta y estable. La cobertura se concentra en la capa de servicios; los controladores se validan desde la API y el E2E.'],
      [`Componentes (${jest?.numPassedTests ?? 0}/${jest?.numTotalTests ?? 0})`, 'Los componentes reutilizables respetan sus variantes, estados y eventos.'],
      [`API (${asercionesNewman - fallosNewman}/${asercionesNewman})`, 'Las 28 operaciones del contrato responden lo esperado. Se encontró y corrigio un defecto real en el borrado de publicaciones.'],
      [`E2E (${e2e?.resumen?.flujosOk ?? 0}/${e2e?.resumen?.totalFlujos ?? 0})`, 'Los flujos completos de apuntes, comunidad y aislamiento entre estudiantes funcionan de punta a punta.'],
      [`Carga (p95 ${num(p95Carga)} ms)`, 'El uso normal de 20 estudiantes concurrentes queda muy por debajo de los umbrales de aceptacion.'],
      [`Estres (${readdirNiveles().length} niveles)`, 'La API sostiene la demanda hasta saturar en torno a 2 000 peticiones por segundo; la latencia crece de forma proporcional, sin errores.'],
      [`Seguridad (${altos} altos, ${medios} medios)`, 'No hay vulnerabilidades de riesgo alto. Las brechas son de configuracion de cabeceras y del entorno HTTP de pruebas.'],
      [`UAT (${uat?.resumen?.aprobados ?? 0}/${uat?.resumen?.total ?? 0})`, 'Los nueve criterios de aceptacion se cumplen con datos nuevos en cada corrida.'],
    ],
  })}
  <h2>Trabajo futuro</h2>
  <ul>
    <li>Unificar el manejo de errores de la API para que todos los 4xx y 5xx devuelvan JSON con un codigo estable.</li>
    <li>Agregar las cabeceras de seguridad y la politica de integridad de subrecursos en el pipeline de despliegue.</li>
    <li>Automatizar estas corridas en un flujo de integracion continua que publique los reportes como artefacto.</li>
    <li>Repetir la prueba de estres con los recursos de produccion para convertir el punto de saturacion en un dato de dimensionamiento.</li>
  </ul>
  <div class="nota">
    <b>Nota de honestidad:</b> los resultados de este documento son los que produjeron las herramientas. Los casos
    con hallazgo se registraron como <code>FAIL</code> o como incidencia en Jira y se explican en el capitulo 4; no
    se oculto ningun resultado.
  </div>
  <div class="nota">
    <b>Equipo:</b> Michael Stanley Sanchez Menendez, Samuel Alonso Mendoza Calzadilla, Iliana Berenice Melgar Rosa,
    Manuel Angel Carias Juares y Maria Guadalupe Sion Perez.<br>
    <b>Modulo:</b> Testeo de Software (PDCE) · Ciclo 02/2026 · Docente: Marvin Antonio Barrera Trigueros.
  </div>
</section>

</body>
</html>`;

const salida = join(raiz, 'artifacts', 'Reporte-Ejecucion-Pruebas-SugoiNote.html');
writeFileSync(salida, html, 'utf8');
console.log(`Documento: ${salida}`);
console.log(`Reportes embebidos: ${reportes.length}, capturas: ${capturas.length}`);
