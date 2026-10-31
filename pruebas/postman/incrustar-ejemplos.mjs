// ─────────────────────────────────────────────────────────────
// Incrusta en la coleccion los ejemplos de respuesta REALES de la
// ultima corrida de Newman.
//
// Por que existe: una coleccion sin ejemplos se publica en Postman con la
// documentacion vacia (solo muestra la peticion). Con los ejemplos, cada
// endpoint queda documentado con una respuesta de verdad, la de la corrida.
//
// Uso:  node pruebas/postman/incrustar-ejemplos.mjs
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');

const rutaColeccion = join(aqui, 'SugoiNote-API-Completa.postman_collection.json');
const rutaResultados = join(raiz, 'artifacts', 'pruebas', 'api', 'resultados.json');

const coleccion = JSON.parse(readFileSync(rutaColeccion, 'utf8'));
const corrida = JSON.parse(readFileSync(rutaResultados, 'utf8'));

const ejecuciones = new Map();
for (const e of corrida.run.executions) {
  if (!e.response) continue;
  ejecuciones.set(e.item.name, e);
}

const cuerpoDe = (respuesta) => {
  if (!respuesta.stream) return '';
  const texto = Buffer.from(respuesta.stream).toString('utf8');
  try {
    return JSON.stringify(JSON.parse(texto), null, 2);
  } catch {
    return texto;
  }
};

let incrustados = 0;
for (const carpeta of coleccion.item) {
  for (const item of carpeta.item) {
    const ejecucion = ejecuciones.get(item.name);
    if (!ejecucion) {
      console.warn('Sin respuesta para: ' + item.name);
      continue;
    }
    const cuerpo = cuerpoDe(ejecucion.response);
    const esJson = (ejecucion.response.header ?? []).some(
      (h) => h.key.toLowerCase() === 'content-type' && String(h.value).includes('json'),
    );

    item.response = [
      {
        name: `Ejemplo real (${ejecucion.response.code}) - corrida ${new Date(corrida.run.timings.started).toISOString().slice(0, 10)}`,
        originalRequest: JSON.parse(JSON.stringify(item.request)),
        status: ejecucion.response.status,
        code: ejecucion.response.code,
        _postman_previewlanguage: esJson ? 'json' : 'html',
        header: (ejecucion.response.header ?? []).map((h) => ({ key: h.key, value: String(h.value) })),
        cookie: [],
        body: cuerpo,
      },
    ];
    incrustados++;
  }
}

// Id fijo: asi la coleccion no cambia de identidad cada vez que se regenera.
coleccion.info._postman_id = 'a1b2c3d4-1111-4222-8333-94455a66b77c';

writeFileSync(rutaColeccion, JSON.stringify(coleccion, null, 2), 'utf8');
console.log(`Ejemplos incrustados: ${incrustados}`);
console.log('Archivo:', rutaColeccion);
