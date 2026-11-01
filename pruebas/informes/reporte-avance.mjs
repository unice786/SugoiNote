// ─────────────────────────────────────────────────────────────
// Reporte breve de avance del Proyecto Integrador: solo el estado de las tres
// capas y los enlaces oficiales de cada una.
//
// Uso: node pruebas/informes/reporte-avance.mjs
// Salida: artifacts/Reporte-Avance-Proyecto-Integrador.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CSS, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts');

const MODULO = 'Proyecto Integrador';
const CICLO = '02/2026';
const FECHA = '13 de octubre de 2026';

const ESTUDIANTES = [
  'Michael Stanley Sanchez Menendez',
  'Samuel Alonso Mendoza Calzadilla',
  'Iliana Berenice Melgar Rosa',
  'Manuel Angel Carias Juares',
  'Maria Guadalupe Sion Perez',
];
const DOCENTE = 'Marvin Antonio Barrera Trigueros';

const REPO = 'https://github.com/unice786/SugoiNote';
const CAPAS = [
  {
    nombre: 'Backend (API y servicios)',
    enlace: `${REPO}/tree/main/SUGOINOTE2/Controllers/Api`,
    detalle:
      'API REST en ASP.NET Core 10 con 7 controladores y 28 operaciones, servicios de negocio por dominio, autenticacion con JWT y cookie, e integracion con Google Gemini.',
    estado: 'Completo',
  },
  {
    nombre: 'Frontend web',
    enlace: `${REPO}/tree/main/SUGOINOTE2/Views`,
    detalle:
      'Cliente web con vistas Razor y controladores MVC: sesion, apuntes, resumenes, examenes, comunidad, chat y perfil. Consume los mismos servicios que la API.',
    estado: 'Completo',
  },
  {
    nombre: 'Aplicacion movil',
    enlace: `${REPO}/tree/main/mobile`,
    detalle:
      'App en React Native y Expo (TypeScript) con 26 pantallas, 12 componentes reutilizables y un cliente HTTP con manejo de sesion.',
    estado: 'Completo',
  },
];

const ESTILOS = `
  :root {
    --texto: #1a1a1a; --texto-suave: #52525b; --borde: #cfd6df;
    --ok: #166534;
  }
  @page {
    size: A4; margin: 20mm 18mm 22mm;
    @bottom-center { content: counter(page); font-family: Arial, sans-serif; font-size: 8pt; color: #6b7280; }
    @bottom-right { content: "SugoiNote · ${MODULO} · ${CICLO}"; font-family: Arial, sans-serif; font-size: 7.5pt; color: #9ca3af; }
  }
  html, body { background: #fff; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 12pt; line-height: 1.45; color: var(--texto); margin: 0; padding: 0; }
  .lienzo { max-width: none; }
  .hoja { break-after: page; }
  h1 { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 15pt; font-weight: 700; color: #111; border-bottom: 1.2pt solid #9ca3af; padding-bottom: 6px; margin: 0 0 14px; }
  p { margin: 8px 0; }
  .capa { border: .8pt solid #d1d5db; padding: 12px 14px; margin: 14px 0; break-inside: avoid; }
  .capa .cabecera { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .capa .nombre { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 13pt; font-weight: 700; color: #111; }
  .capa .estado { font-size: 9pt; font-weight: 700; color: var(--ok); border: .5pt solid #b7d7c1; background: #e9f3ec; padding: 1px 8px; }
  .capa p { margin: 6px 0 8px; }
  .capa .enlace { font-size: 9pt; overflow-wrap: break-word; }
  .capa .enlace a { font-size: 9pt; }
  a { color: #1f2937; text-decoration: underline; text-decoration-color: #9ca3af; text-underline-offset: 1.5px; }
  .nota { background: #f7f7f8; border-left: 2.5pt solid #9ca3af; padding: 10px 12px; margin: 14px 0; color: #374151; break-inside: avoid; }
  .nota b { color: #111; }
  .pie-equipo { margin-top: 22px; font-size: 10pt; color: #52525b; }
  .portada { text-align: center; height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding-top: 8mm; }
`;

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte de Avance - Proyecto Integrador - SugoiNote</title>
<style>${CSS}</style>
<style>${ESTILOS}</style>
<script src="${pathToFileURL(join(aqui, 'paged.polyfill.js')).href}"></script>
</head>
<body>

<section class="hoja">
  <div class="portada">
    <div>
      <div style="font-size:15pt;font-weight:700">ESCUELA SUPERIOR FRANCISCANA ESPECIALIZADA</div>
      <div style="font-size:12.5pt;color:#52525b;margin-top:4px">AGAPE</div>
      <div style="margin-top:24px;font-size:12pt;font-weight:600">CARRERA TÉCNICO EN INGENIERÍA DE DESARROLLO DE SOFTWARE</div>
      <div style="margin-top:4px;font-size:11.5pt;color:#52525b">MÓDULO ${escapar(MODULO)}</div>
    </div>
    <div>
      <div style="font-size:10.5pt;text-transform:uppercase;letter-spacing:1px;color:#52525b;margin-bottom:6px">Título</div>
      <div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:20pt;font-weight:700;line-height:1.25">Reporte de Avance de Proyecto Integrador</div>
      <div style="margin-top:8px;font-size:12.5pt;color:#52525b">Backend, Frontend Web y Aplicación Móvil</div>
    </div>
    <div>
      <div style="font-size:10.5pt;text-transform:uppercase;letter-spacing:1px;color:#52525b;margin-bottom:6px">Estudiantes</div>
      ${ESTUDIANTES.map((e) => `<p style="margin:2px 0;font-size:11pt">${escapar(e)}</p>`).join('')}
    </div>
    <div>
      <div style="font-size:10.5pt;text-transform:uppercase;letter-spacing:1px;color:#52525b;margin-bottom:6px">Docente</div>
      <p style="margin:2px 0;font-size:11pt">${escapar(DOCENTE)}</p>
    </div>
    <div style="font-size:11pt;color:#52525b">
      <p style="margin:2px 0">Fecha de presentación: ${escapar(FECHA)}</p>
      <p style="margin:2px 0">Ciclo: ${escapar(CICLO)}</p>
    </div>
  </div>
</section>

<section class="hoja">
  <h1>Avance del Proyecto Integrador</h1>
  <p>
    Las tres capas de SugoiNote estan implementadas y enlazadas al mismo backend. Cada apartado resume su
    estado y el enlace oficial al codigo correspondiente.
  </p>

  ${CAPAS.map(
    (c) => `
    <div class="capa">
      <div class="cabecera">
        <span class="nombre">${escapar(c.nombre)}</span>
        <span class="estado">${escapar(c.estado)}</span>
      </div>
      <p>${escapar(c.detalle)}</p>
      <div class="enlace"><b>Repositorio:</b>&nbsp;<a href="${c.enlace}">${escapar(c.enlace).replace(/\/([^/]+)$/, '/<wbr>$1')}</a></div>
    </div>`,
  ).join('')}

  <div class="nota">
    <b>Organizacion del repositorio:</b> las tres capas viven en un mismo repositorio publico
    (<a href="${REPO}">github.com/unice786/SugoiNote</a>), separadas por carpetas. La rama principal es
    <code>main</code>.
  </div>

  <div class="pie-equipo">
    Equipo: ${escapar(ESTUDIANTES.join(', '))}.<br>
    Modulo ${escapar(MODULO)} · Ciclo ${escapar(CICLO)} · Docente: ${escapar(DOCENTE)}.
  </div>
</section>

</body>
</html>`;

const salida = join(artefactos, 'Reporte-Avance-Proyecto-Integrador.html');
writeFileSync(salida, html, 'utf8');
console.log(`Documento: ${salida}`);
