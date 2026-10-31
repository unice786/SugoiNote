// ─────────────────────────────────────────────────────────────
// Pruebas de aceptacion del usuario (UAT).
//
// Cada caso representa un criterio de aceptacion del producto expresado como
// lo haria el usuario ("puedo crear un apunte y verlo despues"), y se ejecuta
// contra el entorno Docker completo (API + base de datos + servicio de IA).
//
// Uso:
//   docker run --rm --network sugoinote-pruebas_red-pruebas \
//     -v "${PWD}:/trabajo" -w /trabajo -e BASE_URL=http://api:8080 \
//     node:22-bookworm node pruebas/uat/casos.mjs
//
// Salida: artifacts/pruebas/uat/{resultados.json, index.html}
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from '../informes/plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const salida = join(raiz, 'artifacts', 'pruebas', 'uat');
mkdirSync(salida, { recursive: true });

const BASE = process.env.BASE_URL ?? 'http://localhost:5265';
const CLAVE = 'UatSegura.2026';

const casos = [];

async function api(metodo, ruta, { token, cuerpo } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    redirect: 'manual',
  });
  const texto = await respuesta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* pagina HTML */
  }
  return { estado: respuesta.status, json, texto, cabeceras: respuesta.headers };
}

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function caso(id, titulo, criterio, cuerpo) {
  const actual = { id, titulo, criterio, pasos: [], ok: true, ms: 0 };
  const t0 = Date.now();
  try {
    await cuerpo(actual);
  } catch (error) {
    actual.ok = false;
    actual.error = error.message;
  }
  actual.ms = Date.now() - t0;
  casos.push(actual);
  console.log(`[${actual.ok ? 'PASA' : 'FALLA'}] ${id} ${titulo}`);
  for (const p of actual.pasos) console.log(`        ${p.ok ? 'ok' : 'x '} ${p.texto}${p.ok ? '' : ' -> ' + p.detalle}`);
}

async function paso(actual, texto, accion) {
  const t0 = Date.now();
  try {
    const detalle = await accion();
    actual.pasos.push({ texto, ok: true, ms: Date.now() - t0, detalle: detalle ?? '' });
  } catch (error) {
    actual.pasos.push({ texto, ok: false, ms: Date.now() - t0, detalle: error.message });
    throw error;
  }
}

const sello = () => `${Date.now()}.${Math.floor(Math.random() * 10000)}`;

async function estudiante(prefijo) {
  const correo = `${prefijo}.${sello()}@sugoinote.test`;
  const r = await api('POST', '/api/auth/registrar', {
    cuerpo: { nombreCompleto: `UAT ${prefijo}`, correoElectronico: correo, claveAcceso: CLAVE },
  });
  exigir(r.estado === 200, `no se pudo registrar (${r.estado})`);
  return { correo, token: r.json.token, id: r.json.estudiante.estudianteId };
}

async function apunteDePrueba(token) {
  const r = await api('POST', '/api/apuntes', {
    token,
    cuerpo: {
      tituloNota: 'Docker para el examen',
      contenidoTexto:
        '<h2>Contenedores</h2><p>Un contenedor empaqueta la aplicacion con sus dependencias y comparte el nucleo del sistema operativo. Docker Compose describe y levanta varios servicios respetando sus dependencias.</p>',
      materiaId: null,
      nuevaMateriaNombre: 'Contenedores',
    },
  });
  exigir(r.estado === 200, `no se pudo crear el apunte (${r.estado})`);
  return r.json.apunteId;
}

// ── Casos de aceptacion ──────────────────────────────────────
await caso(
  'UAT-01',
  'Registro e inicio de sesion del estudiante',
  'Un estudiante nuevo puede crear su cuenta con nombre, correo y clave, y entrar al sistema con esas credenciales.',
  async (c) => {
    let correo;
    await paso(c, 'El estudiante se registra con sus datos reales', async () => {
      correo = `uat.acceso.${sello()}@sugoinote.test`;
      const r = await api('POST', '/api/auth/registrar', {
        cuerpo: { nombreCompleto: 'Michael Sanchez', correoElectronico: correo, claveAcceso: CLAVE },
      });
      exigir(r.estado === 200, `el registro respondio ${r.estado}`);
      exigir(r.json.token?.split('.').length === 3, 'no se entrego un token JWT');
      return `cuenta ${correo}`;
    });

    await paso(c, 'Entra con el correo y la clave que acaba de crear', async () => {
      const r = await api('POST', '/api/auth/login', { cuerpo: { correoElectronico: correo, claveAcceso: CLAVE } });
      exigir(r.estado === 200, `el acceso respondio ${r.estado}`);
      exigir(r.json.estudiante?.correoElectronico === correo, 'la sesion no corresponde al correo');
      return 'sesion iniciada correctamente';
    });
  },
);

await caso(
  'UAT-02',
  'Crear un apunte y verlo en el listado',
  'El estudiante escribe un apunte, elige o crea la materia, y al volver al listado el apunte aparece con su contenido.',
  async (c) => {
    const persona = await estudiante('uat.apunte');
    let id;
    await paso(c, 'Escribe un apunte nuevo y crea la materia "Contenedores"', async () => {
      id = await apunteDePrueba(persona.token);
      return `apunte ${id.slice(0, 8)}`;
    });
    await paso(c, 'Al abrir el listado, el apunte aparece con su titulo', async () => {
      const r = await api('GET', '/api/apuntes', { token: persona.token });
      const encontrado = r.json?.find((a) => a.apunteId === id);
      exigir(encontrado, 'el apunte no aparece en el listado');
      exigir(encontrado.tituloNota === 'Docker para el examen', 'el titulo no coincide');
      return `"${encontrado.tituloNota}" en la materia ${encontrado.nombreMateria ?? 'Contenedores'}`;
    });
    await paso(c, 'El contenido escrito se conserva tal cual', async () => {
      const r = await api('GET', `/api/apuntes/${id}`, { token: persona.token });
      exigir(r.json.contenidoTexto.includes('comparte el nucleo'), 'el contenido se perdio');
      return 'contenido completo';
    });
  },
);

await caso(
  'UAT-03',
  'Editar un apunte y conservar los cambios',
  'Mientras el estudiante escribe, la app guarda solo; al volver a abrir el apunte los cambios siguen ahi.',
  async (c) => {
    const persona = await estudiante('uat.edicion');
    const id = await apunteDePrueba(persona.token);

    await paso(c, 'Agrega un parrafo nuevo al apunte', async () => {
      const r = await api('POST', `/api/apuntes/${id}/autosave`, {
        token: persona.token,
        cuerpo: { titulo: 'Docker para el examen', contenido: '<p>Agregado: los volumenes persisten los datos.</p>' },
      });
      exigir(r.estado === 200 && r.json.guardado === true, `el autoguardado respondio ${r.estado}`);
      return 'autoguardado confirmado';
    });

    await paso(c, 'Al reabrir el apunte, el parrafo nuevo sigue ahi', async () => {
      const r = await api('GET', `/api/apuntes/${id}`, { token: persona.token });
      exigir(r.json.contenidoTexto.includes('los volumenes persisten'), 'el cambio no se guardo');
      return 'cambio conservado';
    });
  },
);

await caso(
  'UAT-04',
  'Generar un resumen con IA a partir de un apunte',
  'El estudiante pide un resumen de su apunte y recibe un texto util que queda guardado para consultarlo despues.',
  async (c) => {
    const persona = await estudiante('uat.resumen');
    const id = await apunteDePrueba(persona.token);
    let resumenId;

    await paso(c, 'Pide el resumen del apunte', async () => {
      const r = await api('POST', '/api/resumenes/generar', { token: persona.token, cuerpo: { apunteId: id } });
      exigir(r.estado === 200, `el resumen respondio ${r.estado}`);
      const texto = r.json.resumen ?? r.json.contenido ?? r.json.texto ?? '';
      exigir(texto.length > 80, 'el resumen es demasiado corto');
      resumenId = r.json.resumenId;
      return `${texto.length} caracteres generados`;
    });

    await paso(c, 'El resumen queda disponible en el historial', async () => {
      const r = await api('GET', '/api/resumenes', { token: persona.token });
      exigir(r.estado === 200 && Array.isArray(r.json), 'no se pudo consultar el historial');
      exigir(r.json.some((x) => x.resumenId === resumenId), 'el resumen no aparece guardado');
      return `${r.json.length} resumen(es) en el historial`;
    });
  },
);

await caso(
  'UAT-05',
  'Generar un examen con IA y calificarlo',
  'El estudiante genera un examen de 3 preguntas sobre su apunte, responde y recibe su nota sobre 100.',
  async (c) => {
    const persona = await estudiante('uat.examen');
    const id = await apunteDePrueba(persona.token);
    let examenId;
    let respuestas = {};

    await paso(c, 'Genera un examen de 3 preguntas de opcion multiple', async () => {
      const r = await api('POST', '/api/examenes/generar', {
        token: persona.token,
        cuerpo: { apunteId: id, tipo: 'opcion_multiple', cantidadPreguntas: 3 },
      });
      exigir(r.estado === 200, `la generacion respondio ${r.estado}`);
      examenId = r.json.examenId;
      return `examen ${examenId.slice(0, 8)}`;
    });

    await paso(c, 'El examen trae 3 preguntas con opciones y sin la respuesta revelada', async () => {
      const r = await api('GET', `/api/examenes/${examenId}`, { token: persona.token });
      exigir(r.estado === 200, `el examen respondio ${r.estado}`);
      exigir(r.json.preguntas?.length === 3, `trajo ${r.json.preguntas?.length} preguntas`);
      exigir(r.json.calificado === false, 'el examen aparece calificado antes de responder');
      for (const p of r.json.preguntas) {
        exigir(p.opciones.length >= 2, 'una pregunta trae menos de 2 opciones');
        respuestas[p.preguntaId] = p.opciones[0].opcionId;
      }
      return 'preguntas y opciones completas';
    });

    await paso(c, 'Responde y recibe una nota entre 0 y 100', async () => {
      const r = await api('POST', `/api/examenes/${examenId}/calificar`, { token: persona.token, cuerpo: { respuestas } });
      exigir(r.estado === 200, `la calificacion respondio ${r.estado}`);
      exigir(typeof r.json.nota === 'number' && r.json.nota >= 0 && r.json.nota <= 100, 'la nota esta fuera de la escala 0-100');
      exigir(r.json.total === 3, 'el total de preguntas no es 3');
      return `nota ${r.json.nota}/100 (${r.json.correctas} de ${r.json.total})`;
    });
  },
);

await caso(
  'UAT-06',
  'Publicar una duda y recibir respuesta de otro estudiante',
  'Un estudiante publica una duda en la comunidad y otro estudiante puede responderla y verla en el detalle.',
  async (c) => {
    const autor = await estudiante('uat.autor');
    const companero = await estudiante('uat.companero');
    let postId;

    await paso(c, 'Publica una duda en la comunidad', async () => {
      const r = await api('POST', '/api/comunidad/posts', {
        token: autor.token,
        cuerpo: { titulo: 'Como reinicio un contenedor sin perder datos', detalle: 'Me pasa cada vez que actualizo la imagen.' },
      });
      exigir(r.estado === 200, `la publicacion respondio ${r.estado}`);
      postId = r.json.postId;
      return `publicacion ${postId.slice(0, 8)}`;
    });

    await paso(c, 'Otro estudiante responde la duda', async () => {
      const r = await api('POST', `/api/comunidad/${postId}/responder`, {
        token: companero.token,
        cuerpo: { texto: 'Usa un volumen nombrado y recrea el contenedor con docker compose up -d.' },
      });
      exigir(r.estado === 200 && r.json.ok === true, `la respuesta respondio ${r.estado}`);
      return 'respuesta publicada';
    });

    await paso(c, 'La respuesta se ve en el detalle de la publicacion', async () => {
      const r = await api('GET', `/api/comunidad/${postId}`, { token: autor.token });
      exigir(r.estado === 200, `el detalle respondio ${r.estado}`);
      exigir(r.json.respuestas.length === 1, `se ven ${r.json.respuestas.length} respuestas`);
      exigir(r.json.respuestas[0].texto.includes('volumen nombrado'), 'el texto de la respuesta no coincide');
      return 'respuesta visible para el autor';
    });
  },
);

await caso(
  'UAT-07',
  'Crear una encuesta y votar',
  'El estudiante crea una encuesta con varias opciones, otro estudiante vota y el resultado se actualiza.',
  async (c) => {
    const autor = await estudiante('uat.encuesta');
    const votante = await estudiante('uat.votante');
    let encuestaId;
    let opcionId;

    await paso(c, 'Crea una encuesta con tres opciones', async () => {
      const r = await api('POST', '/api/comunidad/encuestas', {
        token: autor.token,
        cuerpo: {
          titulo: 'Que herramienta usas para probar carga',
          detalle: 'Encuesta de aceptacion.',
          opciones: ['k6', 'JMeter', 'Locust'],
          soloUnaOpcion: true,
        },
      });
      exigir(r.estado === 200, `la encuesta respondio ${r.estado}`);
      encuestaId = r.json.postId;
      return `encuesta ${encuestaId.slice(0, 8)}`;
    });

    await paso(c, 'Otro estudiante elige una opcion', async () => {
      const detalle = await api('GET', `/api/comunidad/${encuestaId}`, { token: votante.token });
      exigir(detalle.json.opciones.length === 3, 'la encuesta no muestra las 3 opciones');
      opcionId = detalle.json.opciones[0].opcionId;
      const r = await api('POST', `/api/comunidad/${encuestaId}/votar`, {
        token: votante.token,
        cuerpo: { opcionIds: [opcionId] },
      });
      exigir(r.estado === 200 && r.json.ok === true, `el voto respondio ${r.estado}`);
      return 'voto registrado';
    });

    await paso(c, 'El resultado muestra el voto y el total actualizado', async () => {
      const r = await api('GET', `/api/comunidad/${encuestaId}`, { token: votante.token });
      exigir(r.json.totalVotos >= 1, 'el total de votos no subio');
      exigir(r.json.opciones.find((o) => o.opcionId === opcionId)?.seleccionada === true, 'el voto no aparece marcado');
      return `${r.json.totalVotos} voto(s) contabilizados`;
    });
  },
);

await caso(
  'UAT-08',
  'Actualizar los datos del perfil',
  'El estudiante cambia su nombre en el perfil y el cambio se refleja cuando vuelve a consultarlo.',
  async (c) => {
    const persona = await estudiante('uat.perfil');
    const nuevoNombre = `Michael Sanchez ${Math.floor(Math.random() * 1000)}`;

    await paso(c, 'Cambia su nombre en el perfil', async () => {
      const r = await api('PUT', '/api/perfil', {
        token: persona.token,
        cuerpo: { nombreCompleto: nuevoNombre, correo: persona.correo },
      });
      exigir(r.estado === 200, `la actualizacion respondio ${r.estado}`);
      return 'cambio guardado';
    });

    await paso(c, 'Al consultar el perfil otra vez, aparece el nombre nuevo', async () => {
      const r = await api('GET', '/api/perfil', { token: persona.token });
      exigir(r.estado === 200, `el perfil respondio ${r.estado}`);
      exigir(r.json.nombreCompleto === nuevoNombre, `el perfil muestra "${r.json.nombreCompleto}"`);
      return r.json.nombreCompleto;
    });
  },
);

await caso(
  'UAT-09',
  'Proteger el contenido cuando no hay sesion',
  'Sin sesion iniciada, el sistema no muestra los apuntes ni permite operar: redirige al acceso o responde no autorizado.',
  async (c) => {
    await paso(c, 'La pagina web de apuntes redirige al inicio de sesion', async () => {
      const r = await api('GET', '/Apuntes/Index');
      exigir(r.estado === 302 || r.estado === 200, `la pagina respondio ${r.estado}`);
      if (r.estado === 302) {
        const destino = r.cabeceras.get('location') ?? '';
        exigir(/login/i.test(destino), `redirige a ${destino}`);
        return `redirige a ${destino}`;
      }
      exigir(/iniciar sesion|login/i.test(r.texto), 'la pagina no pide iniciar sesion');
      return 'la pagina pide iniciar sesion';
    });

    await paso(c, 'La API rechaza las peticiones sin token', async () => {
      for (const ruta of ['/api/apuntes', '/api/perfil', '/api/comunidad']) {
        const r = await api('GET', ruta);
        exigir(r.estado === 401, `${ruta} respondio ${r.estado}`);
      }
      return '401 en las tres rutas privadas';
    });
  },
);

// ── Reporte ──────────────────────────────────────────────────
const aprobados = casos.filter((c) => c.ok).length;
const totalPasos = casos.reduce((s, c) => s + c.pasos.length, 0);
const pasosOk = casos.reduce((s, c) => s + c.pasos.filter((p) => p.ok).length, 0);
const msTotal = casos.reduce((s, c) => s + c.ms, 0);
const todoOk = aprobados === casos.length;

const html = documento({
  titulo: 'Pruebas de aceptacion del usuario (UAT)',
  subtitulo: 'Criterios de aceptacion del producto ejecutados sobre el entorno Docker completo.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'Entorno', valor: BASE },
    { etiqueta: 'Casos', valor: `${casos.length} criterios de aceptacion` },
    { etiqueta: 'Perfil', valor: 'Estudiante (rol unico del sistema)' },
  ],
  tarjetas: [
    { etiqueta: 'Casos aprobados', valor: `${aprobados}/${casos.length}`, tono: todoOk ? 'ok' : 'fallo' },
    { etiqueta: 'Pasos', valor: `${pasosOk}/${totalPasos}`, tono: pasosOk === totalPasos ? 'ok' : 'fallo' },
    { etiqueta: 'Duracion', valor: `${(msTotal / 1000).toFixed(1)} s`, tono: 'acento' },
    { etiqueta: 'Resultado', valor: todoOk ? 'APROBADO' : 'RECHAZADO', tono: todoOk ? 'ok' : 'fallo' },
  ],
  secciones: [
    `<h2>Resultado por criterio de aceptacion</h2>`,
    ...casos.map(
      (c) => `
      <div class="flujo evitar-corte">
        <div class="cabecera">
          <span class="nombre">${escapar(c.id)} · ${escapar(c.titulo)}</span>
          <span class="pastilla ${c.ok ? 'ok' : 'fallo'}">${c.ok ? 'PASA' : 'FALLA'} · ${c.ms} ms</span>
        </div>
        <p class="subtitulo">${escapar(c.criterio)}</p>
        <ul>
          ${c.pasos
            .map(
              (p) =>
                `<li class="${p.ok ? 'ok' : 'fallo'}"><b>${p.ok ? 'OK' : 'X'}</b> ${escapar(p.texto)}${p.detalle ? ' — ' + escapar(p.detalle) : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>`,
    ),
    `<h2>Resumen</h2>`,
    tabla({
      columnas: ['Caso', 'Criterio de aceptacion', 'Pasos', 'Resultado'],
      filas: casos.map((c) => [
        `<b>${escapar(c.id)}</b>`,
        escapar(c.titulo),
        `${c.pasos.filter((p) => p.ok).length}/${c.pasos.length}`,
        `<span class="pastilla ${c.ok ? 'ok' : 'fallo'}">${c.ok ? 'PASA' : 'FALLA'}</span>`,
      ]),
    }),
    `<div class="nota"><b>Como se ejecuto:</b> cada criterio se recorre contra el entorno Docker completo (API, base de datos SQL Server y servicio de IA) con datos nuevos por corrida. La evidencia es la respuesta real de cada paso, no una captura preparada.</div>`,
  ],
});

writeFileSync(
  join(salida, 'resultados.json'),
  JSON.stringify({ base: BASE, fecha: new Date().toISOString(), casos, resumen: { aprobados, total: casos.length, pasosOk, totalPasos, msTotal } }, null, 2),
  'utf8',
);
writeFileSync(join(salida, 'index.html'), html, 'utf8');

console.log(`\n${aprobados}/${casos.length} casos UAT, ${pasosOk}/${totalPasos} pasos, ${(msTotal / 1000).toFixed(1)} s`);
process.exit(todoOk ? 0 : 1);
