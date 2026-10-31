// ─────────────────────────────────────────────────────────────
// Pruebas END-TO-END sobre la API real (flujos de negocio completos).
//
// Cada flujo recorre un camino que un usuario haria de punta a punta y
// comprueba el estado final en la base de datos, no solo el codigo HTTP.
//
// Se ejecuta dentro de Docker, contra el contenedor de la API:
//   docker run --rm --network sugoinote-pruebas_red-pruebas \
//     -v "${PWD}:/trabajo" -w /trabajo node:22-bookworm \
//     node pruebas/e2e/flujos.mjs
//
// Variables: BASE_URL (por defecto http://localhost:5265)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from '../informes/plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const salida = join(raiz, 'artifacts', 'pruebas', 'e2e');
mkdirSync(salida, { recursive: true });

const BASE = process.env.BASE_URL ?? 'http://localhost:5265';
const CLAVE = 'E2eSegura.2026';

// ── Utilidades ───────────────────────────────────────────────
const resultados = [];

async function api(metodo, ruta, { token, cuerpo } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  const texto = await respuesta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* respuesta no JSON (paginas de error) */
  }
  return { estado: respuesta.status, json, texto };
}

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function paso(flujoActual, nombre, accion) {
  const t0 = Date.now();
  try {
    const detalle = await accion();
    flujoActual.pasos.push({ nombre, ok: true, ms: Date.now() - t0, detalle: detalle ?? '' });
  } catch (error) {
    flujoActual.pasos.push({ nombre, ok: false, ms: Date.now() - t0, detalle: error.message });
    throw error;
  }
}

async function flujo(nombre, descripcion, cuerpo) {
  const actual = { nombre, descripcion, pasos: [], ok: true, ms: 0 };
  const t0 = Date.now();
  try {
    await cuerpo(actual);
  } catch (error) {
    actual.ok = false;
    actual.error = error.message;
  }
  actual.ms = Date.now() - t0;
  resultados.push(actual);
  const marca = actual.ok ? 'OK  ' : 'FALLO';
  console.log(`[${marca}] ${nombre} (${actual.ms} ms)`);
  for (const p of actual.pasos) console.log(`        ${p.ok ? 'ok' : 'x '} ${p.nombre}${p.ok ? '' : ' -> ' + p.detalle}`);
}

const sello = () => `${Date.now()}.${Math.floor(Math.random() * 10000)}`;

async function crearEstudiante(prefijo) {
  const correo = `${prefijo}.${sello()}@sugoinote.test`;
  const registro = await api('POST', '/api/auth/registrar', {
    cuerpo: { nombreCompleto: `E2E ${prefijo}`, correoElectronico: correo, claveAcceso: CLAVE },
  });
  exigir(registro.estado === 200, `el registro respondio ${registro.estado}`);
  return { correo, token: registro.json.token, id: registro.json.estudiante.estudianteId };
}

// ── Flujos ───────────────────────────────────────────────────
await flujo(
  'Registro, inicio de sesion y sesion activa',
  'Un estudiante nuevo puede crear su cuenta, entrar y consultar quien es.',
  async (f) => {
    let correo;
    let token;
    await paso(f, 'Registrar un estudiante nuevo', async () => {
      correo = `e2e.sesion.${sello()}@sugoinote.test`;
      const r = await api('POST', '/api/auth/registrar', {
        cuerpo: { nombreCompleto: 'Estudiante E2E', correoElectronico: correo, claveAcceso: CLAVE },
      });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(typeof r.json.token === 'string' && r.json.token.split('.').length === 3, 'el token no es un JWT');
      return `token de ${r.json.token.length} caracteres`;
    });

    await paso(f, 'Iniciar sesion con las mismas credenciales', async () => {
      const r = await api('POST', '/api/auth/login', { cuerpo: { correoElectronico: correo, claveAcceso: CLAVE } });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(r.json.estudiante.correoElectronico === correo, 'el correo devuelto no coincide');
      token = r.json.token;
      return 'sesion iniciada';
    });

    await paso(f, 'Consultar la sesion con el token', async () => {
      const r = await api('GET', '/api/auth/me', { token });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(/^[0-9a-f-]{36}$/i.test(r.json.estudianteId), 'el id del estudiante no es un GUID');
      return `estudiante ${r.json.estudianteId.slice(0, 8)}`;
    });
  },
);

await flujo(
  'Ciclo de vida completo de un apunte',
  'Crear, listar, editar con autoguardado, comprobar el saneado del HTML y eliminar.',
  async (f) => {
    const estudiante = await crearEstudiante('e2e.apunte');
    let apunteId;

    await paso(f, 'Crear un apunte con materia nueva', async () => {
      const r = await api('POST', '/api/apuntes', {
        token: estudiante.token,
        cuerpo: {
          tituloNota: 'Apunte E2E',
          contenidoTexto: '<h2>Docker</h2><p>Contenedores y volumenes.</p><script>alert("xss")</script>',
          materiaId: null,
          nuevaMateriaNombre: 'Infraestructura',
        },
      });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      apunteId = r.json.apunteId;
      return `apunte ${apunteId.slice(0, 8)}`;
    });

    await paso(f, 'Aparece en el listado del estudiante', async () => {
      const r = await api('GET', '/api/apuntes', { token: estudiante.token });
      exigir(r.estado === 200 && Array.isArray(r.json), 'el listado no es un arreglo');
      exigir(r.json.some((a) => a.apunteId === apunteId), 'el apunte recien creado no aparece');
      return `${r.json.length} apunte(s)`;
    });

    await paso(f, 'El HTML peligroso se guarda saneado', async () => {
      const r = await api('GET', `/api/apuntes/${apunteId}`, { token: estudiante.token });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(r.json.contenidoTexto.includes('<h2>Docker</h2>'), 'se perdio el HTML permitido');
      exigir(!r.json.contenidoTexto.includes('<script'), 'el <script> llego intacto a la base de datos');
      return 'script eliminado';
    });

    await paso(f, 'El autoguardado actualiza el contenido', async () => {
      const r = await api('POST', `/api/apuntes/${apunteId}/autosave`, {
        token: estudiante.token,
        cuerpo: { titulo: 'Apunte E2E editado', contenido: '<p>Parrafo agregado por el autoguardado.</p>' },
      });
      exigir(r.estado === 200 && r.json.guardado === true, `autoguardado fallo (${r.estado})`);

      const detalle = await api('GET', `/api/apuntes/${apunteId}`, { token: estudiante.token });
      exigir(detalle.json.contenidoTexto.includes('autoguardado'), 'el cambio no quedo guardado');
      return 'cambio persistido';
    });

    await paso(f, 'La materia nueva quedo creada', async () => {
      const r = await api('GET', '/api/apuntes/materias', { token: estudiante.token });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(r.json.some((m) => m.nombreMateria === 'Infraestructura'), 'no aparece la materia creada');
      return `${r.json.length} materia(s)`;
    });

    await paso(f, 'Eliminar el apunte y confirmar que ya no existe', async () => {
      const borrado = await api('DELETE', `/api/apuntes/${apunteId}`, { token: estudiante.token });
      exigir(borrado.estado === 200 && borrado.json.eliminado === true, `no se pudo eliminar (${borrado.estado})`);
      const consulta = await api('GET', `/api/apuntes/${apunteId}`, { token: estudiante.token });
      exigir(consulta.estado === 404, `el apunte eliminado respondio ${consulta.estado}`);
      return 'eliminado y verificado';
    });
  },
);

await flujo(
  'Comunidad: pregunta con respuesta y encuesta con voto',
  'Publica, otro estudiante responde, se vota y el autor limpia sus publicaciones.',
  async (f) => {
    const autor = await crearEstudiante('e2e.autor');
    const lector = await crearEstudiante('e2e.lector');
    let postId;
    let encuestaId;

    await paso(f, 'El autor publica una pregunta', async () => {
      const r = await api('POST', '/api/comunidad/posts', {
        token: autor.token,
        cuerpo: { titulo: 'Como aislar la base en pruebas', detalle: 'Pregunta del flujo E2E.' },
      });
      exigir(r.estado === 200 && r.json.postId, `no se creo la publicacion (${r.estado})`);
      postId = r.json.postId;
      return `post ${postId.slice(0, 8)}`;
    });

    await paso(f, 'Otro estudiante responde la pregunta', async () => {
      const r = await api('POST', `/api/comunidad/${postId}/responder`, {
        token: lector.token,
        cuerpo: { texto: 'Usando docker compose con una base desechable.' },
      });
      exigir(r.estado === 200 && r.json.ok === true, `no se pudo responder (${r.estado})`);
      return 'respuesta registrada';
    });

    await paso(f, 'El detalle muestra la respuesta y quien la escribio', async () => {
      const r = await api('GET', `/api/comunidad/${postId}`, { token: autor.token });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(r.json.respuestas.length >= 1, 'la respuesta no aparece en el detalle');
      exigir(r.json.esMio === true, 'el autor no ve la publicacion como propia');
      return `${r.json.respuestas.length} respuesta(s)`;
    });

    await paso(f, 'El autor publica una encuesta', async () => {
      const r = await api('POST', '/api/comunidad/encuestas', {
        token: autor.token,
        cuerpo: {
          titulo: 'Que herramienta usas para carga',
          detalle: 'Encuesta del flujo E2E.',
          opciones: ['k6', 'JMeter', 'Locust'],
          soloUnaOpcion: true,
        },
      });
      exigir(r.estado === 200 && r.json.postId, `no se creo la encuesta (${r.estado})`);
      encuestaId = r.json.postId;
      return `encuesta ${encuestaId.slice(0, 8)}`;
    });

    await paso(f, 'El lector vota una opcion', async () => {
      const detalle = await api('GET', `/api/comunidad/${encuestaId}`, { token: lector.token });
      exigir(detalle.estado === 200 && detalle.json.opciones.length === 3, 'la encuesta no trae 3 opciones');
      const opcion = detalle.json.opciones[0].opcionId;

      const voto = await api('POST', `/api/comunidad/${encuestaId}/votar`, {
        token: lector.token,
        cuerpo: { opcionIds: [opcion] },
      });
      exigir(voto.estado === 200 && voto.json.ok === true, `voto rechazado (${voto.estado})`);

      const despues = await api('GET', `/api/comunidad/${encuestaId}`, { token: lector.token });
      exigir(despues.json.totalVotos >= 1, 'el voto no quedo contado');
      exigir(despues.json.opciones.filter((o) => o.seleccionada).length === 1, 'la opcion elegida no aparece marcada');
      return `total de votos: ${despues.json.totalVotos}`;
    });

    await paso(f, 'El autor elimina su pregunta y su encuesta', async () => {
      const p = await api('DELETE', `/api/comunidad/${postId}`, { token: autor.token });
      exigir(p.estado === 200 && p.json.eliminado === true, `no se pudo borrar la pregunta (${p.estado})`);

      const e = await api('DELETE', `/api/comunidad/${encuestaId}`, { token: autor.token });
      exigir(e.estado === 200 && e.json.eliminado === true, `no se pudo borrar la encuesta (${e.estado})`);
      return 'ambas publicaciones eliminadas';
    });
  },
);

await flujo(
  'Aislamiento de datos entre estudiantes',
  'Un estudiante no puede ver ni tocar los apuntes de otro.',
  async (f) => {
    const duenio = await crearEstudiante('e2e.duenio');
    const intruso = await crearEstudiante('e2e.intruso');
    let apunteId;

    await paso(f, 'El duenio crea un apunte', async () => {
      const r = await api('POST', '/api/apuntes', {
        token: duenio.token,
        cuerpo: { tituloNota: 'Privado', contenidoTexto: '<p>Solo para el duenio.</p>', materiaId: null, nuevaMateriaNombre: null },
      });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      apunteId = r.json.apunteId;
      return 'apunte creado';
    });

    await paso(f, 'El intruso no lo ve en su listado', async () => {
      const r = await api('GET', '/api/apuntes', { token: intruso.token });
      exigir(r.estado === 200, `esperaba 200 y vino ${r.estado}`);
      exigir(!r.json.some((a) => a.apunteId === apunteId), 'el intruso ve el apunte ajeno');
      return `${r.json.length} apunte(s) propios`;
    });

    await paso(f, 'El intruso recibe 404 al pedirlo por id', async () => {
      const r = await api('GET', `/api/apuntes/${apunteId}`, { token: intruso.token });
      exigir(r.estado === 404, `esperaba 404 y vino ${r.estado}: el apunte ajeno es accesible`);
      return 'acceso denegado';
    });

    await paso(f, 'El intruso no puede borrarlo', async () => {
      const r = await api('DELETE', `/api/apuntes/${apunteId}`, { token: intruso.token });
      exigir(r.estado !== 200, 'el intruso pudo borrar un apunte ajeno');

      const sigue = await api('GET', `/api/apuntes/${apunteId}`, { token: duenio.token });
      exigir(sigue.estado === 200, 'el apunte desaparecio: el borrado si afecto al duenio');
      return 'el apunte sigue intacto';
    });
  },
);

await flujo(
  'Proteccion de los endpoints privados',
  'Sin token o con un token invalido la API no debe devolver datos.',
  async (f) => {
    const rutas = ['/api/apuntes', '/api/auth/me', '/api/perfil', '/api/comunidad'];

    await paso(f, 'Sin token responde 401 en todas las rutas privadas', async () => {
      for (const ruta of rutas) {
        const r = await api('GET', ruta);
        exigir(r.estado === 401, `${ruta} respondio ${r.estado} en vez de 401`);
      }
      return `${rutas.length} rutas protegidas`;
    });

    await paso(f, 'Con un token falso responde 401', async () => {
      for (const ruta of rutas) {
        const r = await api('GET', ruta, { token: 'eyJhbGciOiJIUzI1NiJ9.falso.firma' });
        exigir(r.estado === 401, `${ruta} respondio ${r.estado} con un token falso`);
      }
      return 'token invalido rechazado';
    });
  },
);

// ── Reporte ──────────────────────────────────────────────────
const totalPasos = resultados.reduce((s, f) => s + f.pasos.length, 0);
const pasosOk = resultados.reduce((s, f) => s + f.pasos.filter((p) => p.ok).length, 0);
const flujosOk = resultados.filter((f) => f.ok).length;
const msTotal = resultados.reduce((s, f) => s + f.ms, 0);

const html = documento({
  titulo: 'Pruebas end-to-end sobre la API',
  subtitulo: 'Recorrido completo de los flujos de negocio contra la API en Docker.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date().toLocaleString('es-GT') },
    { etiqueta: 'URL base', valor: BASE },
    { etiqueta: 'Entorno', valor: 'Docker Compose (API + SQL Server 2022)' },
  ],
  tarjetas: [
    { etiqueta: 'Flujos', valor: `${flujosOk}/${resultados.length}`, tono: flujosOk === resultados.length ? 'ok' : 'fallo' },
    { etiqueta: 'Pasos', valor: `${pasosOk}/${totalPasos}`, tono: pasosOk === totalPasos ? 'ok' : 'fallo' },
    { etiqueta: 'Duracion', valor: `${(msTotal / 1000).toFixed(1)} s`, tono: 'acento' },
    { etiqueta: 'Resultado', valor: flujosOk === resultados.length ? 'PASS' : 'FAIL', tono: flujosOk === resultados.length ? 'ok' : 'fallo' },
  ],
  secciones: [
    `<h2>Resultado por flujo</h2>`,
    ...resultados.map(
      (f) => `
      <div class="flujo evitar-corte">
        <div class="cabecera">
          <span class="nombre">${escapar(f.nombre)}</span>
          <span class="pastilla ${f.ok ? 'ok' : 'fallo'}">${f.ok ? 'PASS' : 'FAIL'} · ${f.ms} ms</span>
        </div>
        <p class="subtitulo">${escapar(f.descripcion)}</p>
        <ul>
          ${f.pasos
            .map(
              (p) =>
                `<li class="${p.ok ? 'ok' : 'fallo'}"><b>${p.ok ? 'OK' : 'X'}</b> ${escapar(p.nombre)} <span class="mono">(${p.ms} ms)</span>${p.detalle ? ' — ' + escapar(p.detalle) : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>`,
    ),
    `<h2>Detalle tecnico</h2>`,
    tabla({
      columnas: ['Flujo', 'Pasos', 'Duracion', 'Estado'],
      filas: resultados.map((f) => [
        escapar(f.nombre),
        `${f.pasos.filter((p) => p.ok).length}/${f.pasos.length}`,
        `${f.ms} ms`,
        `<span class="pastilla ${f.ok ? 'ok' : 'fallo'}">${f.ok ? 'PASS' : 'FAIL'}</span>`,
      ]),
    }),
    `<div class="nota"><b>Alcance:</b> estas pruebas atacan la API por HTTP, igual que lo harian la app movil o la web. No abren un navegador porque la API no expone CORS para terceros y la app movil se ejecuta en un emulador, fuera del alcance del contenedor.</div>`,
  ],
});

writeFileSync(join(salida, 'resultados.json'), JSON.stringify({ base: BASE, fecha: new Date().toISOString(), resultados, resumen: { flujosOk, totalFlujos: resultados.length, pasosOk, totalPasos, msTotal } }, null, 2), 'utf8');
writeFileSync(join(salida, 'index.html'), html, 'utf8');

console.log(`\n${flujosOk}/${resultados.length} flujos, ${pasosOk}/${totalPasos} pasos, ${(msTotal / 1000).toFixed(1)} s`);
console.log('Reporte:', join(salida, 'index.html'));
process.exit(flujosOk === resultados.length ? 0 : 1);
