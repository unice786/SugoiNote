// ─────────────────────────────────────────────────────────────
// Genera la coleccion de Postman COMPLETA a partir del OpenAPI (Swagger)
// que expone la API en ejecucion.
//
// Reglas que aplica:
//   1. Recorre TODAS las operaciones del Swagger y falla si alguna no tiene
//      una receta definida. Asi la coleccion no puede quedar incompleta.
//   2. La carpeta de autenticacion va PRIMERO: el login deja listo {{token}}
//      y el resto de peticiones heredan el Bearer.
//   3. Los identificadores se encadenan con variables de coleccion.
//   4. Cada peticion trae aserciones reales sobre estado y forma del JSON.
//
// Uso:
//   node pruebas/postman/generar-coleccion.mjs [ruta-al-swagger.json]
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');

const rutaSwagger = process.argv[2] ?? join(raiz, 'artifacts', 'pruebas', 'openapi', 'swagger-en-vivo.json');
const swagger = JSON.parse(readFileSync(rutaSwagger, 'utf8'));

const BASE = '{{baseUrl}}';

// Contenido del apunte de prueba: lo bastante rico para que la IA pueda
// resumirlo y sacar preguntas de examen.
const CONTENIDO_APUNTE = [
  '<h2>Contenedores Docker</h2>',
  '<p>Un contenedor es una unidad ligera que empaqueta una aplicacion con sus dependencias. A diferencia de una maquina virtual, comparte el nucleo del sistema operativo del anfitrion, por eso arranca en segundos y consume menos memoria.</p>',
  '<p>Una imagen es la plantilla de solo lectura a partir de la cual se crean los contenedores. Se construye por capas: cada instruccion del Dockerfile agrega una capa y las capas se reutilizan entre imagenes, lo que acelera las construcciones posteriores.</p>',
  '<p>Un volumen permite que los datos sobrevivan cuando el contenedor se destruye. Los datos del contenedor son efimeros: si se elimina la instancia, la informacion escrita dentro de su sistema de archivos se pierde.</p>',
  '<ul>',
  '<li>La red bridge permite que los contenedores se comuniquen por nombre de servicio.</li>',
  '<li>Las variables de entorno configuran el contenedor sin reconstruir la imagen.</li>',
  '<li>Las politicas de reinicio reinician el servicio si el proceso falla.</li>',
  '</ul>',
  '<p>Docker Compose describe varios servicios en un solo archivo y los levanta con un comando, respetando el orden de dependencias y las comprobaciones de salud.</p>',
].join('');

const ids = (lista) => lista.map((s) => (s.startsWith('{{') ? s : s));

function urlDe(plantilla) {
  // /api/apuntes/{id} -> {{baseUrl}}/api/apuntes/{{apunteId}}
  const mapa = {
    '{id}': '{{idRuta}}',
    '{apunteId}': '{{apunteId}}',
  };
  const segmentos = plantilla
    .split('/')
    .filter(Boolean)
    .map((s) => (mapa[s] ? mapa[s] : s));
  return {
    raw: `${BASE}/${segmentos.join('/')}`,
    host: [BASE],
    path: segmentos,
  };
}

function peticion({ nombre, metodo, ruta, descripcion, cuerpo, auth, tests, prerequest, idRuta }) {
  const headers = [];
  const metodoUpper = metodo.toUpperCase();
  if (cuerpo !== undefined) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    headers.push({ key: 'Accept', value: 'application/json' });
  }
  const item = {
    name: nombre,
    event: [],
    request: {
      method: metodoUpper,
      header: headers,
      url: urlDe(ruta),
      description: descripcion ?? '',
    },
    response: [],
  };

  if (idRuta) {
    item.request.url.path = item.request.url.path.map((s) => (s === '{{idRuta}}' ? idRuta : s));
    item.request.url.raw = `${BASE}/${item.request.url.path.join('/')}`;
  }

  if (cuerpo !== undefined) {
    const raw = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo, null, 2);
    item.request.body = { mode: 'raw', raw, options: { raw: { language: 'json' } } };
  }
  if (auth === 'noauth') item.request.auth = { type: 'noauth' };

  if (prerequest) {
    item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest } });
  }
  if (tests && tests.length) {
    item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests } });
  }
  return item;
}

// ── Aserciones reutilizables ─────────────────────────────────
const ok200 = [
  "pm.test('Responde 200 OK', () => pm.response.to.have.status(200));",
  "pm.test('El cuerpo es JSON', () => pm.response.to.be.json);",
];
const error400 = [
  "pm.test('Rechaza la peticion con 400', () => pm.response.to.have.status(400));",
  "pm.test('Devuelve un mensaje de error legible', () => { const b = pm.response.json(); pm.expect(b.error).to.be.a('string').and.not.empty; });",
];

// ── Recetas por operacion del OpenAPI ────────────────────────
// clave: "METODO /ruta/del/swagger"
const recetas = {
  // ── 00 Autenticacion ───────────────────────────────────────
  'POST /api/auth/registrar': {
    carpeta: '00 · Autenticacion',
    nombre: 'Registrar estudiante (crea el usuario de la corrida)',
    descripcion: 'Crea un estudiante con correo unico por ejecucion. Deja listo el token para el resto de la coleccion.',
    auth: 'noauth',
    cuerpo: {
      nombreCompleto: 'Estudiante de Pruebas {{$timestamp}}',
      correoElectronico: '{{correoPrueba}}',
      claveAcceso: '{{clavePrueba}}',
    },
    prerequest: [
      "// Correo unico por corrida: el registro falla si el correo ya existe.",
      "const sello = `${Date.now()}.${Math.floor(Math.random() * 100000)}`;",
      "pm.collectionVariables.set('correoPrueba', `qa.${sello}@sugoinote.test`);",
      "pm.collectionVariables.set('clavePrueba', 'PruebaSegura.2026');",
      "console.log('Correo de la corrida:', pm.collectionVariables.get('correoPrueba'));",
    ],
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un token JWT', () => pm.expect(b.token).to.be.a('string').and.not.empty);",
      "pm.test('El token tiene tres segmentos (JWT)', () => pm.expect(b.token.split('.')).to.have.lengthOf(3));",
      "pm.test('Devuelve el estudiante creado', () => pm.expect(b.estudiante.correoElectronico).to.eql(pm.collectionVariables.get('correoPrueba')));",
      "pm.test('El identificador del estudiante es un GUID', () => pm.expect(b.estudiante.estudianteId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.collectionVariables.set('token', b.token);",
      "pm.collectionVariables.set('estudianteId', b.estudiante.estudianteId);",
    ],
  },
  'POST /api/auth/login': {
    carpeta: '00 · Autenticacion',
    nombre: 'Iniciar sesion y guardar el token',
    descripcion: 'Autentica con las credenciales creadas arriba y guarda {{token}} para las demas peticiones.',
    auth: 'noauth',
    cuerpo: { correoElectronico: '{{correoPrueba}}', claveAcceso: '{{clavePrueba}}' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un token JWT', () => pm.expect(b.token).to.be.a('string').and.not.empty);",
      "pm.test('El correo coincide con el registrado', () => pm.expect(b.estudiante.correoElectronico).to.eql(pm.collectionVariables.get('correoPrueba')));",
      "pm.collectionVariables.set('token', b.token);",
    ],
  },
  'GET /api/auth/me': {
    carpeta: '00 · Autenticacion',
    nombre: 'Consultar la sesion actual',
    descripcion: 'Valida que el Bearer identifica al estudiante autenticado.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el identificador del estudiante autenticado', () => pm.expect(b.estudianteId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.test('Es el mismo estudiante del registro', () => pm.expect(b.estudianteId).to.eql(pm.collectionVariables.get('estudianteId')));",
    ],
  },

  // ── 01 Apuntes ─────────────────────────────────────────────
  'POST /api/apuntes': {
    carpeta: '01 · Apuntes',
    nombre: 'Crear apunte con materia nueva',
    descripcion: 'Crea el apunte de la corrida. Incluye una etiqueta <script> para comprobar el saneado del HTML.',
    cuerpo: {
      tituloNota: 'Apunte de pruebas {{$timestamp}}',
      contenidoTexto: `${CONTENIDO_APUNTE}<script>alert('xss')</script>`,
      materiaId: null,
      nuevaMateriaNombre: 'Docker y Contenedores',
    },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el identificador del apunte', () => pm.expect(b.apunteId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.collectionVariables.set('apunteId', b.apunteId);",
    ],
  },
  'GET /api/apuntes': {
    carpeta: '01 · Apuntes',
    nombre: 'Listar apuntes del estudiante',
    descripcion: 'Listado propio: no debe traer apuntes de otros usuarios.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo', () => pm.expect(b).to.be.an('array'));",
      "pm.test('Incluye el apunte recien creado', () => pm.expect(b.map((x) => x.apunteId)).to.include(pm.collectionVariables.get('apunteId')));",
      "pm.test('Cada apunte trae titulo y materia', () => { const a = b.find((x) => x.apunteId === pm.collectionVariables.get('apunteId')); pm.expect(a.tituloNota).to.be.a('string').and.not.empty; pm.expect(a.materiaNombre).to.eql('Docker y Contenedores'); });",
    ],
  },
  'GET /api/apuntes/{id}': {
    carpeta: '01 · Apuntes',
    nombre: 'Obtener apunte y verificar el saneado',
    descripcion: 'El contenido guardado no debe conservar la etiqueta <script> enviada al crear.',
    idRuta: '{{apunteId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el apunte solicitado', () => pm.expect(b.apunteId).to.eql(pm.collectionVariables.get('apunteId')));",
      "pm.test('El contenido conserva el HTML permitido', () => pm.expect(b.contenidoTexto).to.include('<h2>Contenedores Docker</h2>'));",
      "pm.test('El saneador elimina los scripts', () => pm.expect(b.contenidoTexto).to.not.include('<script'));",
    ],
  },
  'POST /api/apuntes/{id}/autosave': {
    carpeta: '01 · Apuntes',
    nombre: 'Guardado automatico del editor',
    descripcion: 'Guarda titulo y contenido como lo hace el editor del movil.',
    idRuta: '{{apunteId}}',
    cuerpo: {
      titulo: 'Apunte de pruebas (autoguardado)',
      contenido: `${CONTENIDO_APUNTE}<p>Parrafo agregado por el autoguardado.</p>`,
    },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma el guardado', () => pm.expect(b.guardado).to.eql(true));",
    ],
  },
  'GET /api/apuntes/materias': {
    carpeta: '01 · Apuntes',
    nombre: 'Listar materias del estudiante',
    descripcion: 'Debe incluir la materia creada junto con el apunte.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo de materias', () => pm.expect(b).to.be.an('array').and.not.empty);",
      "pm.test('Incluye la materia nueva', () => pm.expect(b.map((m) => m.nombreMateria)).to.include('Docker y Contenedores'));",
      "pm.collectionVariables.set('materiaId', (b.find((m) => m.nombreMateria === 'Docker y Contenedores') || {}).materiaId);",
    ],
  },

  // ── 02 Resumenes ───────────────────────────────────────────
  'GET /api/resumenes/apuntes': {
    carpeta: '02 · Resumenes',
    nombre: 'Apuntes disponibles para resumir',
    descripcion: 'Selector que usa el movil antes de generar un resumen.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo', () => pm.expect(b).to.be.an('array'));",
      "pm.test('Incluye el apunte de la corrida', () => pm.expect(b.map((x) => String(x.apunteId).toLowerCase())).to.include(String(pm.collectionVariables.get('apunteId')).toLowerCase()));",
    ],
  },
  'POST /api/resumenes/generar': {
    carpeta: '02 · Resumenes',
    nombre: 'Generar resumen con IA (Gemini)',
    descripcion: 'Llama al servicio de IA. Puede tardar decenas de segundos: el runner usa timeout de 180 s.',
    cuerpo: { apunteId: '{{apunteId}}' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el resumen generado', () => pm.expect(b.resumen).to.be.a('string').and.not.empty);",
      "pm.test('El resumen trae texto, no solo etiquetas HTML', () => pm.expect(b.resumen.replace(/<[^>]+>/g, '').trim().length).to.be.above(40));",
    ],
  },
  'GET /api/resumenes/{apunteId}': {
    carpeta: '02 · Resumenes',
    nombre: 'Obtener el resumen guardado',
    descripcion: 'Confirma que el resumen generado quedo persistido.',
    idRuta: '{{apunteId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('El resumen pertenece al apunte de la corrida', () => pm.expect(String(b.apunteId).toLowerCase()).to.eql(String(pm.collectionVariables.get('apunteId')).toLowerCase()));",
      "pm.test('El resumen guardado no esta vacio', () => pm.expect(b.resumen).to.be.a('string').and.not.empty);",
    ],
  },
  'GET /api/resumenes': {
    carpeta: '02 · Resumenes',
    nombre: 'Listar resumenes del estudiante',
    descripcion: 'Solo devuelve apuntes que ya tienen resumen.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo', () => pm.expect(b).to.be.an('array'));",
      "pm.test('Incluye el resumen recien generado', () => pm.expect(b.map((x) => String(x.apunteId).toLowerCase())).to.include(String(pm.collectionVariables.get('apunteId')).toLowerCase()));",
    ],
  },

  // ── 03 Examenes ────────────────────────────────────────────
  'POST /api/examenes/generar': {
    carpeta: '03 · Examenes',
    nombre: 'Generar examen con IA (3 preguntas)',
    descripcion: 'Genera un examen de opcion multiple a partir del apunte.',
    cuerpo: { apunteId: '{{apunteId}}', tipo: 'opcion_multiple', cantidadPreguntas: 3 },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el identificador del examen', () => pm.expect(b.examenId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.collectionVariables.set('examenId', b.examenId);",
    ],
  },
  'GET /api/examenes/{id}': {
    carpeta: '03 · Examenes',
    nombre: 'Obtener examen sin calificar',
    descripcion: 'Antes de calificar NO debe revelarse cual opcion es la correcta.',
    idRuta: '{{examenId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('El examen pertenece a la corrida', () => pm.expect(String(b.examenId).toLowerCase()).to.eql(String(pm.collectionVariables.get('examenId')).toLowerCase()));",
      "pm.test('Trae 3 preguntas', () => pm.expect(b.preguntas).to.have.lengthOf(3));",
      "pm.test('Cada pregunta trae al menos 2 opciones', () => b.preguntas.forEach((p) => pm.expect(p.opciones.length).to.be.at.least(2)));",
      "pm.test('No revela la respuesta correcta antes de calificar', () => pm.expect(b.calificado).to.eql(false));",
      "pm.test('Ninguna opcion viene marcada como correcta', () => b.preguntas.forEach((p) => p.opciones.forEach((o) => pm.expect(o.esLaCorrecta === true).to.eql(false))));",
      "const respuestas = {}; b.preguntas.forEach((p) => { respuestas[p.preguntaId] = p.opciones[0].opcionId; });",
      "pm.collectionVariables.set('respuestasExamenJson', JSON.stringify(respuestas));",
    ],
  },
  'POST /api/examenes/{id}/calificar': {
    carpeta: '03 · Examenes',
    nombre: 'Calificar el examen',
    descripcion: 'Envia un mapa pregunta -> opcion elegida y devuelve la nota.',
    idRuta: '{{examenId}}',
    cuerpo: '{"respuestas": {{respuestasExamenJson}}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve la nota calculada', () => pm.expect(b.nota).to.be.a('number'));",
      "pm.test('El total coincide con las 3 preguntas', () => pm.expect(b.total).to.eql(3));",
      "pm.test('Las correctas no superan el total', () => pm.expect(b.correctas).to.be.within(0, 3));",
      // La nota se guarda en escala 0-100 (la vista web la muestra como porcentaje
      // y aprueba desde 70), no en escala 0-10.
      "pm.test('La nota esta en la escala 0-100', () => pm.expect(b.nota).to.be.within(0, 100));",
    ],
  },
  'GET /api/examenes/{id}#calificado': {
    carpeta: '03 · Examenes',
    nombre: 'Obtener examen ya calificado',
    descripcion: 'Despues de calificar si se expone cual era la opcion correcta.',
    ruta: '/api/examenes/{{examenId}}',
    idRuta: '{{examenId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('El examen figura como calificado', () => pm.expect(b.calificado).to.eql(true));",
      "pm.test('Trae la nota final', () => pm.expect(b.nota).to.be.a('number'));",
      "pm.test('Ahora si marca las opciones correctas', () => { const total = b.preguntas.reduce((s, p) => s + p.opciones.filter((o) => o.esLaCorrecta === true).length, 0); pm.expect(total).to.be.at.least(1); });",
    ],
  },
  'GET /api/examenes': {
    carpeta: '03 · Examenes',
    nombre: 'Listar examenes del estudiante',
    descripcion: 'Incluye el examen generado y su nota.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo', () => pm.expect(b).to.be.an('array'));",
      "pm.test('Incluye el examen de la corrida', () => pm.expect(b.map((x) => String(x.examenId).toLowerCase())).to.include(String(pm.collectionVariables.get('examenId')).toLowerCase()));",
      "pm.test('El examen ya tiene nota', () => { const e = b.find((x) => String(x.examenId).toLowerCase() === String(pm.collectionVariables.get('examenId')).toLowerCase()); pm.expect(e.nota).to.be.a('number'); });",
    ],
  },

  // ── 04 Chat ────────────────────────────────────────────────
  'POST /api/chat/enviar': {
    carpeta: '04 · Chat',
    nombre: 'Enviar mensaje al asistente de IA',
    descripcion: 'Chat academico basado en Gemini.',
    cuerpo: { mensaje: 'Explica en dos frases que es un contenedor de Docker.' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve una respuesta del asistente', () => pm.expect(b.respuesta).to.be.a('string').and.not.empty);",
      "pm.test('La respuesta menciona el tema consultado', () => pm.expect(b.respuesta.toLowerCase()).to.match(/contenedor|docker/));",
    ],
  },

  // ── 05 Comunidad ───────────────────────────────────────────
  'POST /api/comunidad/posts': {
    carpeta: '05 · Comunidad',
    nombre: 'Publicar una pregunta en la comunidad',
    descripcion: 'Crea una publicacion de tipo pregunta.',
    cuerpo: { titulo: 'Como aislar la base de datos en pruebas', detalle: 'Publicacion creada por la coleccion automatizada de Postman.' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el identificador de la publicacion', () => pm.expect(b.postId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.collectionVariables.set('postId', b.postId);",
    ],
  },
  'POST /api/comunidad/encuestas': {
    carpeta: '05 · Comunidad',
    nombre: 'Publicar una encuesta',
    descripcion: 'Crea una encuesta con tres opciones.',
    cuerpo: {
      titulo: 'Que herramienta usas para pruebas de carga',
      detalle: 'Encuesta creada por la coleccion automatizada de Postman.',
      opciones: ['k6', 'JMeter', 'Locust'],
      soloUnaOpcion: true,
    },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el identificador de la encuesta', () => pm.expect(b.postId).to.match(/^[0-9a-f-]{36}$/i));",
      "pm.collectionVariables.set('encuestaId', b.postId);",
    ],
  },
  'GET /api/comunidad': {
    carpeta: '05 · Comunidad',
    nombre: 'Listar publicaciones (paginado)',
    descripcion: 'Pagina 0, 20 elementos por pagina.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve un arreglo', () => pm.expect(b).to.be.an('array'));",
      "pm.test('Incluye la pregunta publicada', () => pm.expect(b.map((x) => String(x.postId).toLowerCase())).to.include(String(pm.collectionVariables.get('postId')).toLowerCase()));",
      "pm.test('Incluye la encuesta publicada', () => pm.expect(b.map((x) => String(x.postId).toLowerCase())).to.include(String(pm.collectionVariables.get('encuestaId')).toLowerCase()));",
      "pm.test('Marca como propias las publicaciones de la corrida', () => { const p = b.find((x) => String(x.postId).toLowerCase() === String(pm.collectionVariables.get('postId')).toLowerCase()); pm.expect(p.esMio).to.eql(true); });",
    ],
  },
  'GET /api/comunidad/{id}': {
    carpeta: '05 · Comunidad',
    nombre: 'Obtener detalle de la pregunta',
    descripcion: 'Detalle con respuestas.',
    idRuta: '{{postId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Es la publicacion solicitada', () => pm.expect(String(b.postId).toLowerCase()).to.eql(String(pm.collectionVariables.get('postId')).toLowerCase()));",
      "pm.test('No es una encuesta', () => pm.expect(b.esEncuesta).to.eql(false));",
      "pm.test('Trae el arreglo de respuestas', () => pm.expect(b.respuestas).to.be.an('array'));",
    ],
  },
  'POST /api/comunidad/{id}/responder': {
    carpeta: '05 · Comunidad',
    nombre: 'Responder a la publicacion',
    descripcion: 'Agrega una respuesta a la pregunta creada.',
    idRuta: '{{postId}}',
    cuerpo: { texto: 'Respuesta automatica de la coleccion de pruebas.' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma la respuesta', () => pm.expect(b.ok).to.eql(true));",
    ],
  },
  'GET /api/comunidad/{id}#encuesta': {
    carpeta: '05 · Comunidad',
    nombre: 'Obtener detalle de la encuesta (guarda opciones)',
    descripcion: 'Guarda el identificador de la primera opcion para poder votar.',
    ruta: '/api/comunidad/{{encuestaId}}',
    idRuta: '{{encuestaId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Es una encuesta', () => pm.expect(b.esEncuesta).to.eql(true));",
      "pm.test('Trae las 3 opciones', () => pm.expect(b.opciones).to.have.lengthOf(3));",
      "pm.test('La encuesta admite una sola opcion', () => pm.expect(b.soloUnaOpcion).to.eql(true));",
      "pm.collectionVariables.set('opcionIdsJson', JSON.stringify([b.opciones[0].opcionId]));",
    ],
  },
  'POST /api/comunidad/{id}/votar': {
    carpeta: '05 · Comunidad',
    nombre: 'Votar en la encuesta',
    descripcion: 'Registra un voto en la primera opcion.',
    idRuta: '{{encuestaId}}',
    cuerpo: '{"opcionIds": {{opcionIdsJson}}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma el voto', () => pm.expect(b.ok).to.eql(true));",
    ],
  },
  'GET /api/comunidad/{id}#voto': {
    carpeta: '05 · Comunidad',
    nombre: 'Verificar el voto registrado',
    descripcion: 'La opcion elegida debe aparecer como seleccionada y sumar votos.',
    ruta: '/api/comunidad/{{encuestaId}}',
    idRuta: '{{encuestaId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('La encuesta registra al menos un voto', () => pm.expect(b.totalVotos).to.be.at.least(1));",
      "pm.test('La opcion elegida aparece como seleccionada', () => pm.expect(b.opciones.filter((o) => o.seleccionada === true)).to.have.lengthOf(1));",
    ],
  },
  'DELETE /api/comunidad/{id}': {
    carpeta: '05 · Comunidad',
    nombre: 'Eliminar la pregunta',
    descripcion: 'Limpieza de la publicacion creada.',
    idRuta: '{{postId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma la eliminacion', () => pm.expect(b.eliminado).to.eql(true));",
    ],
  },
  'DELETE /api/comunidad/{id}#encuesta': {
    carpeta: '05 · Comunidad',
    nombre: 'Eliminar la encuesta',
    descripcion: 'Limpieza de la encuesta creada.',
    ruta: '/api/comunidad/{{encuestaId}}',
    idRuta: '{{encuestaId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma la eliminacion', () => pm.expect(b.eliminado).to.eql(true));",
    ],
  },

  // ── 06 Perfil ──────────────────────────────────────────────
  'GET /api/perfil': {
    carpeta: '06 · Perfil',
    nombre: 'Consultar perfil y estadisticas',
    descripcion: 'Debe reflejar los datos creados durante la corrida.',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Devuelve el estudiante de la corrida', () => pm.expect(String(b.estudianteId).toLowerCase()).to.eql(String(pm.collectionVariables.get('estudianteId')).toLowerCase()));",
      "pm.test('Cuenta al menos un apunte', () => pm.expect(b.totalApuntes).to.be.at.least(1));",
      "pm.test('Cuenta al menos un resumen', () => pm.expect(b.totalResumenes).to.be.at.least(1));",
      "pm.test('Cuenta al menos un examen', () => pm.expect(b.totalExamenes).to.be.at.least(1));",
      "pm.test('Trae el correo registrado', () => pm.expect(b.correoElectronico).to.eql(pm.collectionVariables.get('correoPrueba')));",
    ],
  },
  'PUT /api/perfil': {
    carpeta: '06 · Perfil',
    nombre: 'Actualizar nombre del perfil',
    descripcion: 'Conserva el correo para no invalidar el login de la corrida.',
    cuerpo: { nombreCompleto: 'Estudiante Actualizado {{$timestamp}}', correo: '{{correoPrueba}}' },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma la actualizacion', () => pm.expect(b.mensaje).to.be.a('string').and.not.empty);",
    ],
  },
  'PUT /api/perfil/foto': {
    carpeta: '06 · Perfil',
    nombre: 'Actualizar foto de perfil (data URI)',
    descripcion: 'Envia un PNG de 1x1 en data URI.',
    cuerpo: {
      fotoPerfil:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    },
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma el guardado de la foto', () => pm.expect(b.mensaje).to.be.a('string').and.not.empty);",
    ],
  },

  // ── 07 Seguridad (casos negativos) ─────────────────────────
  'GET /api/comunidad sin token': {
    carpeta: '07 · Seguridad',
    nombre: 'Comunidad sin token responde 401',
    descripcion: 'Caso negativo: un endpoint protegido no debe responder sin Bearer.',
    ruta: '/api/comunidad',
    auth: 'noauth',
    tests: [
      "pm.test('Rechaza la peticion sin token (401)', () => pm.response.to.have.status(401));",
      "pm.test('No filtra datos de la comunidad', () => pm.expect(pm.response.text()).to.not.include('postId'));",
    ],
  },
  'POST /api/auth/login incorrecto': {
    carpeta: '07 · Seguridad',
    nombre: 'Login con clave incorrecta responde 400',
    descripcion: 'Caso negativo: credenciales invalidas no generan token.',
    ruta: '/api/auth/login',
    auth: 'noauth',
    cuerpo: { correoElectronico: '{{correoPrueba}}', claveAcceso: 'clave-equivocada-2026' },
    tests: [
      ...error400,
      "pm.test('No devuelve ningun token', () => pm.expect(pm.response.text()).to.not.include('token'));",
    ],
  },

  // ── 99 Limpieza ────────────────────────────────────────────
  'DELETE /api/apuntes/{id}': {
    carpeta: '99 · Limpieza',
    nombre: 'Eliminar el apunte de la corrida',
    descripcion: 'Deja la base como estaba antes de la ejecucion.',
    idRuta: '{{apunteId}}',
    tests: [
      ...ok200,
      "const b = pm.response.json();",
      "pm.test('Confirma la eliminacion', () => pm.expect(b.eliminado).to.eql(true));",
    ],
  },
  'GET /api/apuntes/{id} eliminado': {
    carpeta: '99 · Limpieza',
    nombre: 'El apunte eliminado responde 404',
    descripcion: 'Verifica que la eliminacion fue efectiva.',
    ruta: '/api/apuntes/{{apunteId}}',
    tests: [
      "pm.test('El apunte ya no existe (404)', () => pm.response.to.have.status(404));",
    ],
  },
};

// ── Armado de la coleccion ───────────────────────────────────
const operaciones = [];
const porClave = new Map();
for (const [ruta, metodos] of Object.entries(swagger.paths)) {
  for (const [metodo, op] of Object.entries(metodos)) {
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(metodo)) continue;
    const clave = `${metodo.toUpperCase()} ${ruta}`;
    const operacion = { clave, ruta, metodo, op };
    operaciones.push(operacion);
    porClave.set(clave, operacion);
  }
}

const sinReceta = operaciones.filter((o) => !recetas[o.clave]);
if (sinReceta.length) {
  console.error('Faltan recetas para estas operaciones del Swagger:');
  for (const f of sinReceta) console.error('  - ' + f.clave);
  process.exit(1);
}

// Orden de ejecucion EXPLICITO: Postman respeta el orden del arreglo, y el
// orden del documento Swagger no sirve (pondria el DELETE antes del POST).
const ORDEN = [
  'POST /api/auth/registrar',
  'POST /api/auth/login',
  'GET /api/auth/me',
  'POST /api/apuntes',
  'GET /api/apuntes',
  'GET /api/apuntes/{id}',
  'POST /api/apuntes/{id}/autosave',
  'GET /api/apuntes/materias',
  'GET /api/resumenes/apuntes',
  'POST /api/resumenes/generar',
  'GET /api/resumenes/{apunteId}',
  'GET /api/resumenes',
  'POST /api/examenes/generar',
  'GET /api/examenes/{id}',
  'POST /api/examenes/{id}/calificar',
  'GET /api/examenes/{id}#calificado',
  'GET /api/examenes',
  'POST /api/chat/enviar',
  'POST /api/comunidad/posts',
  'POST /api/comunidad/encuestas',
  'GET /api/comunidad',
  'GET /api/comunidad/{id}',
  'POST /api/comunidad/{id}/responder',
  'GET /api/comunidad/{id}#encuesta',
  'POST /api/comunidad/{id}/votar',
  'GET /api/comunidad/{id}#voto',
  'DELETE /api/comunidad/{id}',
  'DELETE /api/comunidad/{id}#encuesta',
  'GET /api/perfil',
  'PUT /api/perfil',
  'PUT /api/perfil/foto',
  'GET /api/comunidad sin token',
  'POST /api/auth/login incorrecto',
  'DELETE /api/apuntes/{id}',
  'GET /api/apuntes/{id} eliminado',
];

// Toda operacion del Swagger tiene que estar en el orden, y toda clave del
// orden tiene que existir como receta. Asi la cobertura no puede romperse.
const enOrden = new Set(ORDEN);
const fueraDeOrden = operaciones.filter((o) => !enOrden.has(o.clave));
if (fueraDeOrden.length) {
  console.error('Operaciones del Swagger que no estan en ORDEN:');
  for (const f of fueraDeOrden) console.error('  - ' + f.clave);
  process.exit(1);
}
const sinRecetaEnOrden = ORDEN.filter((k) => !recetas[k]);
if (sinRecetaEnOrden.length) {
  console.error('Claves de ORDEN sin receta: ' + sinRecetaEnOrden.join(', '));
  process.exit(1);
}

const ordenCarpetas = [
  '00 · Autenticacion',
  '01 · Apuntes',
  '02 · Resumenes',
  '03 · Examenes',
  '04 · Chat',
  '05 · Comunidad',
  '06 · Perfil',
  '07 · Seguridad',
  '99 · Limpieza',
];

const carpetas = new Map(ordenCarpetas.map((n) => [n, { name: n, item: [] }]));

for (const clave of ORDEN) {
  const receta = recetas[clave];
  const operacion = porClave.get(clave);
  const ruta = receta.ruta ?? operacion?.ruta;
  if (!ruta) {
    console.error('No se pudo resolver la ruta de: ' + clave);
    process.exit(1);
  }
  const descripcion = [
    operacion?.op.summary,
    receta.descripcion,
    operacion ? `Endpoint del OpenAPI: ${clave}` : null,
    operacion ? null : 'Caso adicional (no forma parte del contrato OpenAPI).',
  ]
    .filter(Boolean)
    .join('\n\n');

  carpetas.get(receta.carpeta).item.push(
    peticion({
      nombre: receta.nombre,
      metodo: clave.split(' ')[0],
      ruta,
      descripcion,
      cuerpo: receta.cuerpo,
      auth: receta.auth,
      tests: receta.tests,
      prerequest: receta.prerequest,
      idRuta: receta.idRuta,
    }),
  );
}

const coleccion = {
  info: {
    _postman_id: randomUUID(),
    name: 'SugoiNote API - Pruebas completas',
    description:
      'Coleccion generada automaticamente desde el OpenAPI de la API (Swagger).\n' +
      'Cubre las 28 operaciones documentadas, mas casos negativos de seguridad.\n\n' +
      'La carpeta 00 deja listo el token JWT; el resto de peticiones lo heredan.\n' +
      'Variables: baseUrl (por defecto http://localhost:5265).\n\n' +
      'Ejecucion por consola:\n  newman run <archivo> --env-var baseUrl=http://localhost:5265',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
  },
  event: [],
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5265', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'estudianteId', value: '', type: 'string' },
    { key: 'apunteId', value: '', type: 'string' },
    { key: 'materiaId', value: '', type: 'string' },
    { key: 'examenId', value: '', type: 'string' },
    { key: 'postId', value: '', type: 'string' },
    { key: 'encuestaId', value: '', type: 'string' },
    { key: 'opcionIdsJson', value: '', type: 'string' },
    { key: 'respuestasExamenJson', value: '', type: 'string' },
    { key: 'correoPrueba', value: '', type: 'string' },
    { key: 'clavePrueba', value: '', type: 'string' },
  ],
  item: ordenCarpetas.map((n) => carpetas.get(n)).filter((c) => c.item.length > 0),
};

const salida = join(aqui, 'SugoiNote-API-Completa.postman_collection.json');
writeFileSync(salida, JSON.stringify(coleccion, null, 2), 'utf8');

const totalPeticiones = coleccion.item.reduce((s, c) => s + c.item.length, 0);
const totalAserciones = coleccion.item.reduce(
  (s, c) => s + c.item.reduce((t, i) => t + (i.event.find((e) => e.listen === 'test')?.script.exec.length ?? 0), 0),
  0,
);

console.log('Coleccion generada:', salida);
console.log('Operaciones del OpenAPI cubiertas:', operaciones.length + ' de ' + operaciones.length);
console.log('Peticiones en la coleccion:', totalPeticiones);
console.log('Lineas de asercion:', totalAserciones);
console.log('Carpetas:', coleccion.item.map((c) => `${c.name} (${c.item.length})`).join(' | '));
