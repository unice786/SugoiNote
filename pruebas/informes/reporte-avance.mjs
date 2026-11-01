// ─────────────────────────────────────────────────────────────
// Reporte de Avance del Proyecto Integrador (Backend, Frontend y Movil).
//
// Uso: node pruebas/informes/reporte-avance.mjs
// Salida: artifacts/Reporte-Avance-Proyecto-Integrador.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CSS, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts');

const MODULO = 'Proyecto Integrador';
const CICLO = '02/2026';
const FECHA = '31 de octubre de 2026';

const ESTUDIANTES = [
  'Michael Stanley Sanchez Menendez',
  'Samuel Alonso Mendoza Calzadilla',
  'Iliana Berenice Melgar Rosa',
  'Manuel Angel Carias Juares',
  'Maria Guadalupe Sion Perez',
];
const DOCENTE = 'Marvin Antonio Barrera Trigueros';

const REPO = 'https://github.com/unice786/SugoiNote';
const ENLACES = {
  backend: `${REPO}/tree/main/SUGOINOTE2/Controllers/Api`,
  web: `${REPO}/tree/main/SUGOINOTE2/Views`,
  movil: `${REPO}/tree/main/mobile`,
};

const ESTILOS = `
  :root {
    --texto: #1a1a1a; --texto-suave: #52525b; --borde: #cfd6df;
    --ok: #166534; --fallo: #9f1239; --aviso: #92400e;
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
  .seccion { break-before: page; }
  h1, h2, .titulo-reporte { font-family: Georgia, "Times New Roman", serif; color: #111; }
  h1 { font-size: 17pt; font-weight: 700; border-bottom: 1.2pt solid #9ca3af; padding-bottom: 6px; margin: 0 0 14px; }
  h2 { font-size: 12.5pt; border-bottom: .6pt solid #d1d5db; padding-bottom: 4px; margin: 18px 0 8px; }
  p { margin: 8px 0; }
  ul { margin: 8px 0 8px 18px; padding: 0; }
  li { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 10px 0 16px; }
  thead th { background: #eef0f2; color: #3f3f46; border-bottom: .8pt solid #9ca3af; text-transform: uppercase; font-size: 8.2pt; letter-spacing: .04em; text-align: left; }
  th, td { padding: 6px 8px; border-bottom: .5pt solid #dfe3e8; vertical-align: top; text-align: left; }
  code, .mono { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }
  a { color: #1f2937; text-decoration: underline; text-decoration-color: #9ca3af; text-underline-offset: 1.5px; }
  .nota { background: #f7f7f8; border-left: 2.5pt solid #9ca3af; padding: 10px 12px; margin: 12px 0; color: #374151; break-inside: avoid; }
  .nota b { color: #111; }
  .tarjetas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 18px; }
  .tarjeta { border: .8pt solid #d1d5db; padding: 10px 12px; break-inside: avoid; }
  .tarjeta .valor { font-size: 16pt; font-weight: 700; color: #111; }
  .tarjeta .etiqueta { font-size: 8.5pt; color: #52525b; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
  .portada { text-align: center; height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding-top: 8mm; }
  .portada .escuela { font-size: 15pt; font-weight: 700; letter-spacing: .4px; }
  .portada .sub { font-size: 12.5pt; color: var(--texto-suave); margin-top: 4px; }
  .portada .carrera { margin-top: 24px; font-size: 12pt; font-weight: 600; }
  .portada .modulo { margin-top: 4px; font-size: 11.5pt; color: var(--texto-suave); }
  .portada .titulo { font-family: Georgia, "Times New Roman", serif; font-size: 22pt; font-weight: 700; line-height: 1.25; }
  .portada .bajada { margin-top: 8px; font-size: 12.5pt; color: var(--texto-suave); }
  .portada .rotulo { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1px; color: var(--texto-suave); margin-bottom: 6px; }
  .portada p { margin: 2px 0; font-size: 11pt; }
  .tabla-enlaces { table-layout: fixed; }
  .tabla-enlaces td:nth-child(2) { word-break: normal; overflow-wrap: break-word; }
  .tabla-enlaces td:nth-child(2) a { font-size: 9.5pt; }
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

<!-- ================= PORTADA ================= -->
<section class="hoja">
  <div class="portada">
    <div>
      <div class="escuela">ESCUELA SUPERIOR FRANCISCANA ESPECIALIZADA</div>
      <div class="sub">AGAPE</div>
      <div class="carrera">CARRERA TÉCNICO EN INGENIERÍa DE DESARROLLO DE SOFTWARE</div>
      <div class="modulo">MÓDULO ${escapar(MODULO)}</div>
    </div>
    <div>
      <div class="rotulo">Título</div>
      <div class="titulo">Reporte de Avance de Proyecto Integrador</div>
      <div class="bajada">Backend, Frontend Web y Aplicación Móvil</div>
    </div>
    <div>
      <div class="rotulo">Estudiantes</div>
      ${ESTUDIANTES.map((e) => `<p>${escapar(e)}</p>`).join('')}
    </div>
    <div>
      <div class="rotulo">Docente</div>
      <p>${escapar(DOCENTE)}</p>
    </div>
    <div>
      <p>Fecha de presentación: ${escapar(FECHA)}</p>
      <p>Ciclo: ${escapar(CICLO)}</p>
    </div>
  </div>
</section>

<!-- ================= 1 ================= -->
<section class="seccion" id="resumen">
  <h1>1. Resumen del avance</h1>
  <p>
    SugoiNote es una plataforma de estudio para estudiantes: permite crear apuntes con un editor de bloques,
    generar resumenes y examenes con inteligencia artificial, participar en una comunidad con encuestas y
    consultar el desempeno personal. El trabajo del modulo se desarrollo sobre una sola base de codigo con
    tres capas desplegables: el backend en ASP.NET Core, el cliente web con Razor y la aplicacion movil en
    React Native (Expo).
  </p>
  ${tabla({
    columnas: ['Capa', 'Tecnologia', 'Alcance entregado'],
    filas: [
      [
        'Backend (API y servicios)',
        'ASP.NET Core 10, Entity Framework Core, SQL Server',
        '7 controladores de API con 28 operaciones, 12 servicios de negocio, autenticacion con JWT y cookie, integracion con Google Gemini y limite de peticiones por usuario.',
      ],
      [
        'Frontend web',
        'Razor Views, controladores MVC, CSS propio',
        '7 modulos de interfaz (apuntes, resumenes, examenes, comunidad, chat, perfil y sesion) enlazados a los mismos servicios de la API.',
      ],
      [
        'Aplicacion movil',
        'React Native 0.8x y Expo SDK 57, TypeScript',
        '26 pantallas, 12 componentes reutilizables y un cliente HTTP con manejo de sesion y token.',
      ],
    ],
  })}
  <div class="tarjetas">
    <div class="tarjeta"><div class="valor">28</div><div class="etiqueta">Operaciones de API</div></div>
    <div class="tarjeta"><div class="valor">7</div><div class="etiqueta">Modulos web</div></div>
    <div class="tarjeta"><div class="valor">26</div><div class="etiqueta">Pantallas moviles</div></div>
    <div class="tarjeta"><div class="valor">32</div><div class="etiqueta">Commits del modulo</div></div>
  </div>
</section>

<!-- ================= 2 BACKEND ================= -->
<section class="seccion" id="backend">
  <h1>2. Backend (API y servicios)</h1>
  <p>
    El backend concentra la logica de negocio y expone todo lo que consumen la web y la app movil. Está
    organizado por dominio: cada servicio tiene su interfaz, su implementacion y su controlador de API.
  </p>

  <h2>2.1 Arquitectura y organizacion</h2>
  <ul>
    <li><b>Controladores de API</b> (<code>Controllers/Api</code>): auth, apuntes, resumenes, examenes, comunidad, chat y perfil.</li>
    <li><b>Servicios</b> (<code>Services</code>): una clase por dominio, registradas con inyeccion de dependencias.</li>
    <li><b>Acceso a datos</b>: Entity Framework Core sobre SQL Server, con migraciones y un esquema que tambien puede crearse desde el modelo en el entorno de pruebas.</li>
    <li><b>Seguridad</b>: hash BCrypt para las claves, JWT para la app movil, cookie para la web, limites de peticiones por IP y por usuario, y saneado de HTML en todo contenido que se guarda.</li>
    <li><b>Integracion con IA</b>: cliente propio para Google Gemini con modelo principal y modelo rapido, timeout, reintentos y traduccion de errores del proveedor.</li>
  </ul>

  <h2>2.2 Servicios de negocio entregados</h2>
  ${tabla({
    columnas: ['Servicio', 'Responsabilidad'],
    filas: [
      ['ApunteService', 'Alta rapida y completa de apuntes, autoguardado, resumenes y borrado con control de propietario.'],
      ['AuthService', 'Registro, inicio de sesion, bloqueo por intentos fallidos y recuperacion de clave con token de un solo uso.'],
      ['ExamenService', 'Generacion de examenes con IA a partir de un apunte, calificacion y calculo de nota.'],
      ['ResumenService', 'Resumenes con IA, extraccion de texto de los apuntes y persistencia del resultado.'],
      ['ComunidadService', 'Publicaciones, encuestas, votos simples y multiples, respuestas y borrado.'],
      ['ChatService', 'Asistente de estudio con contexto de los apuntes del propio estudiante.'],
      ['PerfilService', 'Datos del perfil, foto, estadisticas y promedio de examenes.'],
      ['GeminiClient y servicios de apoyo', 'Cliente de IA, saneador de HTML, correo, tokens JWT y usuario actual.'],
    ],
  })}

  <h2>2.3 Contrato de la API</h2>
  <p>
    El contrato OpenAPI publicado tiene <b>24 rutas</b> y <b>28 operaciones</b>, documentadas con Swagger. De
    ese contrato se genero la coleccion de Postman que se usa para verificar la API en cada corrida.
  </p>
  <div class="nota">
    <b>Verificacion:</b> la API esta cubierta por 238 pruebas unitarias, 35 peticiones de Postman con 140
    aserciones, 5 flujos end-to-end y 9 criterios de aceptacion de usuario. Los resultados de esas corridas
    se entregan en el reporte de ejecucion de pruebas.
  </div>
</section>

<!-- ================= 3 WEB ================= -->
<section class="seccion" id="web">
  <h1>3. Frontend web</h1>
  <p>
    El cliente web se sirve desde el mismo proyecto ASP.NET Core con vistas Razor. Cada modulo tiene su
    controlador MVC y sus vistas, y consume los servicios directamente en el servidor: la sesion viaja en
    una cookie y las vistas no exponen logica de negocio.
  </p>

  <h2>3.1 Modulos de interfaz</h2>
  ${tabla({
    columnas: ['Modulo', 'Vistas principales', 'Que resuelve'],
    filas: [
      ['Sesion', 'Login, registro, recuperar y restablecer clave', 'Entrada a la plataforma con validacion y mensajes de error.'],
      ['Apuntes', 'Listado, editor y alta rapida', 'Creacion y edicion de apuntes con autoguardado y saneado del contenido.'],
      ['Resumenes', 'Listado, generacion y detalle', 'Resumenes generados por IA sobre un apunte, con estados de carga y error.'],
      ['Examenes', 'Listado, generacion, resolucion y resultado', 'Examenes de practica, calificacion y retroalimentacion.'],
      ['Comunidad', 'Foro, detalle y encuestas', 'Publicaciones, respuestas y votos entre estudiantes.'],
      ['Chat', 'Conversacion con el asistente', 'Consulta sobre los apuntes propios con respuesta de la IA.'],
      ['Perfil', 'Perfil, edicion y estadisticas', 'Datos personales, foto y metricas de estudio.'],
    ],
  })}

  <h2>3.2 Criterios de interfaz</h2>
  <ul>
    <li>Diseno adaptado a escritorio y a pantallas pequenas, con una barra lateral de navegacion.</li>
    <li>Formularios con validacion en el servidor y mensajes claros para el usuario.</li>
    <li>Estados vacios, de carga y de error en cada listado.</li>
    <li>Contenido generado por el usuario siempre saneado antes de mostrarse.</li>
  </ul>
</section>

<!-- ================= 4 MOVIL ================= -->
<section class="seccion" id="movil">
  <h1>4. Aplicacion movil</h1>
  <p>
    La app movil esta hecha con React Native y Expo (TypeScript), con navegacion por archivos y un cliente
    HTTP propio que guarda el token y resuelve la sesion. Comparte el mismo backend que la web.
  </p>

  <h2>4.1 Pantallas entregadas</h2>
  ${tabla({
    columnas: ['Grupo', 'Pantallas', 'Funcion'],
    filas: [
      ['Autenticacion', 'Login y registro', 'Inicio de sesion y creacion de cuenta con token JWT.'],
      ['Inicio', 'Resumen del estudiante', 'Accesos rapidos a apuntes, examenes y comunidad.'],
      ['Apuntes', 'Listado, alta, detalle/edicion', 'Creacion de apuntes y edicion con autoguardado.'],
      ['Resumenes', 'Listado, generacion y detalle', 'Resumen de un apunte generado con IA.'],
      ['Examenes', 'Listado, generacion, resolucion y resultado', 'Practica guiada con calificacion inmediata.'],
      ['Comunidad', 'Foro y detalle', 'Publicaciones, respuestas y votos.'],
      ['Chat', 'Conversacion', 'Asistente de estudio con el contexto de los apuntes.'],
      ['Perfil', 'Perfil y edicion', 'Datos, foto y estadisticas del estudiante.'],
    ],
  })}

  <h2>4.2 Componentes y calidad</h2>
  <ul>
    <li><b>12 componentes reutilizables</b> (botones, tarjetas, campos, avatares, estados vacios, esqueletos y avisos) con variantes de tamano y color.</li>
    <li><b>16 pruebas de componentes</b> con Jest y Testing Library, con cobertura sobre los componentes que se usan en las pantallas.</li>
    <li>Cliente HTTP centralizado con manejo de errores, sesion vencida y mensajes al usuario.</li>
  </ul>
</section>

<!-- ================= 5 REPOSITORIOS ================= -->
<section class="seccion" id="repositorios">
  <h1>5. Repositorios oficiales</h1>
  <p>
    Las tres capas viven en un mismo repositorio publico, organizado por carpetas. Cada enlace abre
    directamente la parte del codigo que corresponde a la capa evaluada.
  </p>
  <table class="tabla-enlaces">
    <thead><tr><th style="width:20%">Capa</th><th style="width:50%">Enlace oficial</th><th style="width:30%">Contenido</th></tr></thead>
    <tbody>
      <tr>
        <td><b>Backend (API y servicios)</b></td>
        <td><a href="${ENLACES.backend}">https://github.com/unice786/SugoiNote/tree/main/<wbr>SUGOINOTE2/Controllers/Api</a></td>
        <td>Controladores de API, servicios de negocio y acceso a datos.</td>
      </tr>
      <tr>
        <td><b>Frontend web</b></td>
        <td><a href="${ENLACES.web}">https://github.com/unice786/SugoiNote/tree/main/<wbr>SUGOINOTE2/Views</a></td>
        <td>Vistas Razor y controladores MVC del cliente web.</td>
      </tr>
      <tr>
        <td><b>Aplicacion movil</b></td>
        <td><a href="${ENLACES.movil}">https://github.com/unice786/SugoiNote/tree/main/<wbr>mobile</a></td>
        <td>Proyecto Expo: pantallas, componentes y cliente HTTP.</td>
      </tr>
      <tr>
        <td><b>Repositorio completo</b></td>
        <td><a href="${REPO}">https://github.com/unice786/SugoiNote</a></td>
        <td>Solucion completa, pruebas automatizadas y configuracion de Docker.</td>
      </tr>
    </tbody>
  </table>
  <div class="nota">
    <b>Acceso:</b> el repositorio es publico y responde sin autenticacion. La rama principal es <code>main</code>;
    el trabajo de pruebas y el entorno Docker quedan en la rama <code>pruebas</code>.
  </div>
</section>

<!-- ================= 6 VERSIONES ================= -->
<section class="seccion" id="versiones">
  <h1>6. Control de versiones y aportes</h1>
  <p>
    El trabajo se versiono en Git y se publico en GitHub. Cada commit lleva el nombre del integrante que lo
    hizo, con el formato acordado por el equipo (<code>SG[n] Nombre: descripcion</code>), lo que permite
    rastrear quien hizo cada cambio.
  </p>
  ${tabla({
    columnas: ['Integrante (identidad en Git)', 'Commits'],
    filas: [
      ['Michael Sanchez', '27'],
      ['Manuel Carias', '3'],
      ['Samuel Mendoza', '1'],
      ['unice786 (cuenta del repositorio)', '1'],
    ],
  })}
  <p class="subtitulo">
    Total: 32 commits entre el 15 y el 31 de octubre de 2026, sobre la rama <code>pruebas</code> y luego <code>main</code>.
  </p>
  <div class="nota">
    <b>Trazabilidad:</b> los commits de prueba siguen el formato <code>SG[1] Michael Sanchez: ...</code>, de modo
    que el historial de GitHub muestra el autor de cada cambio sin necesidad de un documento aparte.
  </div>
</section>

<!-- ================= 7 CIERRE ================= -->
<section class="seccion" id="estado">
  <h1>7. Estado y proximos pasos</h1>
  <h2>Estado actual</h2>
  <ul>
    <li>Las tres capas estan implementadas y funcionando contra el mismo backend.</li>
    <li>La API esta documentada, versionada y cubierta por pruebas automatizadas y de aceptacion.</li>
    <li>El entorno completo se levanta con Docker, incluida la base de datos y el servicio de pruebas.</li>
  </ul>
  <h2>Proximos pasos</h2>
  <ul>
    <li>Publicar el cliente web y la API en un entorno con HTTPS y respaldo de base de datos.</li>
    <li>Unificar el manejo de errores de la API para que todos los 4xx y 5xx devuelvan JSON.</li>
    <li>Agregar las cabeceras de seguridad que marco el escaneo de OWASP ZAP.</li>
    <li>Ampliar las pruebas de componentes a las pantallas que hoy no tienen cobertura.</li>
  </ul>
  <div class="nota">
    <b>Equipo:</b> ${ESTUDIANTES.join(', ')}.<br>
    <b>Modulo:</b> ${escapar(MODULO)} · Ciclo ${escapar(CICLO)} · Docente: ${escapar(DOCENTE)}.
  </div>
</section>

</body>
</html>`;

const salida = join(artefactos, 'Reporte-Avance-Proyecto-Integrador.html');
writeFileSync(salida, html, 'utf8');
console.log(`Documento: ${salida}`);
if (!existsSync(join(aqui, 'paged.polyfill.js'))) {
  console.warn('Falta paged.polyfill.js: el indice y los cortes de pagina no se van a resolver.');
}
