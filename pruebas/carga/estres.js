// ─────────────────────────────────────────────────────────────
// Prueba de ESTRES con k6.
//
// Se ejecuta varias veces con una cantidad fija de usuarios virtuales (NIVEL)
// para encontrar el punto donde la API deja de responder bien. Cada nivel dura
// 25 segundos y deja su propio resumen, y el reporte arma la tabla comparativa.
//
//   NIVEL=25  docker run ... grafana/k6 run /scripts/estres.js
//   NIVEL=50  ...
//   NIVEL=100 ...
//   NIVEL=200 ...
// ─────────────────────────────────────────────────────────────
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5266';
const NIVEL = Number(__ENV.NIVEL || 50);
const CLAVE = 'EstresSegura.2026';

export const options = {
  scenarios: {
    saturacion: {
      executor: 'constant-vus',
      vus: NIVEL,
      duration: '25s',
      gracefulStop: '5s',
    },
  },
  thresholds: {
    // En el estres no se aborta: se quiere ver donde empieza a fallar.
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: false }],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const sello = `${Date.now()}.${Math.floor(Math.random() * 10000)}`;
  const correo = `estres.${NIVEL}.${sello}@sugoinote.test`;

  const registro = http.post(
    `${BASE}/api/auth/registrar`,
    JSON.stringify({ nombreCompleto: `Estres ${NIVEL}`, correoElectronico: correo, claveAcceso: CLAVE }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (registro.status !== 200) throw new Error(`No se pudo registrar el usuario de estres: ${registro.status}`);

  const autorizacion = { headers: { Authorization: `Bearer ${registro.json('token')}` } };

  for (let i = 0; i < 3; i++) {
    http.post(
      `${BASE}/api/apuntes`,
      JSON.stringify({
        tituloNota: `Apunte de estres ${i + 1}`,
        contenidoTexto: '<p>Contenido para la prueba de estres.</p>',
        materiaId: null,
        nuevaMateriaNombre: 'Estres',
      }),
      { ...autorizacion, headers: { ...autorizacion.headers, 'Content-Type': 'application/json' } },
    );
  }

  return { headers: autorizacion.headers };
}

export default function (datos) {
  const h = datos.headers;

  const apuntes = http.get(`${BASE}/api/apuntes`, { headers: h, tags: { endpoint: 'listar-apuntes' } });
  check(apuntes, { 'listar apuntes responde 200': (r) => r.status === 200 });

  const comunidad = http.get(`${BASE}/api/comunidad`, { headers: h, tags: { endpoint: 'comunidad' } });
  check(comunidad, { 'comunidad responde 200': (r) => r.status === 200 });

  // Sin pausa: el objetivo es saturar, no imitar el uso normal.
}

export function handleSummary(data) {
  return {
    [`/scripts/resumen-estres-${NIVEL}.json`]: JSON.stringify(data, null, 2),
    stdout: `\nNivel ${NIVEL} VUs: ${data.metrics.http_reqs.values.count} peticiones, ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)} % de errores, p95 ${data.metrics.http_req_duration.values['p(95)'].toFixed(0)} ms\n`,
  };
}
