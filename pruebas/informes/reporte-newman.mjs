// ─────────────────────────────────────────────────────────────
// Reporte HTML de la corrida de Newman (pruebas de API).
//
// Uso: node pruebas/informes/reporte-newman.mjs
// Entrada: artifacts/pruebas/api/resultados.json
//          pruebas/postman/SugoiNote-API-Completa.postman_collection.json
// Salida:  artifacts/pruebas/api/index.html
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { documento, escapar, tabla } from './plantilla.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const carpeta = join(raiz, 'artifacts', 'pruebas', 'api');

const corrida = JSON.parse(readFileSync(join(carpeta, 'resultados.json'), 'utf8'));
const coleccion = JSON.parse(
  readFileSync(join(raiz, 'pruebas', 'postman', 'SugoiNote-API-Completa.postman_collection.json'), 'utf8'),
);

// Carpeta a la que pertenece cada peticion (por nombre).
const carpetaDe = new Map();
for (const grupo of coleccion.item) {
  for (const item of grupo.item ?? []) carpetaDe.set(item.name, grupo.name);
}

const ejecuciones = corrida.run.executions.map((e) => {
  const aserciones = e.assertions ?? [];
  return {
    carpeta: carpetaDe.get(e.item.name) ?? 'General',
    nombre: e.item.name,
    metodo: e.request.method,
    ruta: '/' + (e.request.url?.path ?? []).join('/'),
    estado: e.response?.code ?? 0,
    ms: e.response?.responseTime ?? 0,
    credito: e.response?.responseSize ?? 0,
    aserciones,
    fallos: aserciones.filter((a) => a.error),
  };
});

const carpetas = new Map();
for (const e of ejecuciones) {
  const actual = carpetas.get(e.carpeta) ?? { nombre: e.carpeta, peticiones: 0, ms: 0, fallos: 0 };
  actual.peticiones++;
  actual.ms += e.ms;
  actual.fallos += e.fallos.length;
  carpetas.set(e.carpeta, actual);
}

const totalAserciones = ejecuciones.reduce((s, e) => s + e.aserciones.length, 0);
const asercionesFallidas = ejecuciones.reduce((s, e) => s + e.fallos.length, 0);
const peticiones = ejecuciones.length;
// Los casos negativos devuelven 4xx a proposito: solo es un problema si ademas
// fallo alguna asercion.
const negativas = ejecuciones.filter((e) => e.estado >= 400).length;
const duracion = (corrida.run.timings.completed - corrida.run.timings.started) / 1000;
const promedio = Math.round(ejecuciones.reduce((s, e) => s + e.ms, 0) / peticiones);
const masLenta = ejecuciones.slice().sort((a, b) => b.ms - a.ms)[0];
const todoOk = asercionesFallidas === 0;

const html = documento({
  titulo: 'Pruebas de API con Postman + Newman',
  subtitulo: 'Coleccion generada desde el OpenAPI de la API y ejecutada en el pipeline de Docker.',
  meta: [
    { etiqueta: 'Fecha', valor: new Date(corrida.run.timings.started).toLocaleString('es-GT') },
    { etiqueta: 'Coleccion', valor: `${coleccion.info.name} (${peticiones} peticiones)` },
    { etiqueta: 'Ejecutor', valor: 'newman + newman-reporter-htmlextra en Docker' },
    { etiqueta: 'API bajo prueba', valor: 'http://api:8080 (contenedor sugoinote-api)' },
  ],
  tarjetas: [
    { etiqueta: 'Peticiones', valor: String(peticiones), tono: 'acento' },
    { etiqueta: 'Aserciones', valor: `${totalAserciones - asercionesFallidas}/${totalAserciones}`, tono: asercionesFallidas === 0 ? 'ok' : 'fallo' },
    { etiqueta: 'Aserciones fallidas', valor: String(asercionesFallidas), tono: asercionesFallidas === 0 ? 'ok' : 'fallo' },
    { etiqueta: 'Casos negativos', valor: String(negativas), tono: 'neutra' },
    { etiqueta: 'Duracion', valor: `${duracion.toFixed(1)} s`, tono: 'acento' },
    { etiqueta: 'Respuesta media', valor: `${promedio} ms`, tono: 'acento' },
    { etiqueta: 'Resultado', valor: todoOk ? 'PASS' : 'FAIL', tono: todoOk ? 'ok' : 'fallo' },
  ],
  secciones: [
    `<h2>Resultado por carpeta de la coleccion</h2>`,
    tabla({
      columnas: ['Carpeta', 'Peticiones', 'Aserciones fallidas', 'Tiempo acumulado', 'Estado'],
      filas: [...carpetas.values()].map((c) => [
        escapar(c.nombre),
        String(c.peticiones),
        c.fallos ? `<span class="fallo">${c.fallos}</span>` : '0',
        `${c.ms} ms`,
        `<span class="pastilla ${c.fallos === 0 ? 'ok' : 'fallo'}">${c.fallos === 0 ? 'PASS' : 'FAIL'}</span>`,
      ]),
    }),
    `<h2>Detalle de cada peticion</h2>`,
    `<p class="subtitulo">Cada fila es una peticion real de la corrida, con el codigo HTTP que devolvio la API y cuantas aserciones se evaluaron sobre la respuesta.</p>`,
    tabla({
      columnas: ['Carpeta', 'Peticion', 'Metodo', 'Ruta', 'HTTP', 'Aserciones', 'Tiempo'],
      filas: ejecuciones.map((e) => [
        escapar(e.carpeta),
        escapar(e.nombre),
        `<span class="mono">${e.metodo}</span>`,
        `<span class="mono">${escapar(e.ruta)}</span>`,
        `<span class="pastilla ${e.estado < 400 ? 'ok' : 'fallo'}">${e.estado}</span>`,
        e.fallos.length
          ? `<span class="fallo">${e.aserciones.length - e.fallos.length}/${e.aserciones.length}</span>`
          : `${e.aserciones.length}/${e.aserciones.length}`,
        `${e.ms} ms`,
      ]),
    }),
    asercionesFallidas
      ? `<h2>Fallos encontrados</h2>${tabla({
          columnas: ['Peticion', 'Asercion', 'Detalle'],
          filas: ejecuciones.flatMap((e) =>
            e.fallos.map((f) => [
              escapar(e.nombre),
              escapar(f.assertion),
              `<span class="mono">${escapar((f.error?.message ?? '').split('\n')[0])}</span>`,
            ]),
          ),
        })}`
      : `<div class="nota"><b>Sin fallos:</b> las ${totalAserciones} aserciones de la corrida se cumplieron y ninguna peticion devolvio un codigo de error inesperado.</div>`,
    `<h2>Que valida la coleccion</h2>
     <ul>
       <li>Cada endpoint del OpenAPI tiene su peticion y una asercion sobre el codigo HTTP.</li>
       <li>Los identificadores viajan entre peticiones por variables de coleccion (crear y luego consultar).</li>
       <li>Los casos negativos comprueban que la API rechace datos invalidos y peticiones sin sesion.</li>
       <li>Una prueba de cobertura falla si el OpenAPI trae una operacion que la coleccion no cubre.</li>
     </ul>`,
    `<div class="nota"><b>Hallazgo documentado:</b> la API responde a los errores con la pagina HTML de <code>/Home/CodigoError</code>, no con JSON. Las aserciones de los casos negativos validan el codigo HTTP y no intentan interpretar el cuerpo como JSON; queda registrado como observacion de contrato.</div>`,
    masLenta
      ? `<div class="nota"><b>Peticion mas lenta:</b> ${escapar(masLenta.nombre)} (${masLenta.metodo} ${escapar(masLenta.ruta)}) con ${masLenta.ms} ms.</div>`
      : '',
  ],
});

writeFileSync(join(carpeta, 'index.html'), html, 'utf8');
console.log(`Reporte: ${join(carpeta, 'index.html')}`);
console.log(`${peticiones} peticiones, ${totalAserciones - asercionesFallidas}/${totalAserciones} aserciones`);
if (!todoOk) process.exit(1);
