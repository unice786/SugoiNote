// ─────────────────────────────────────────────────────────────
// Prueba de CARGA con k6.
//
// Simula estudiantes navegando la app: consultan sus apuntes, sus materias,
// su perfil y la comunidad. La carga sube de 0 a 20 usuarios virtuales y se
// mantiene un minuto para que las mediciones sean estables.
//
// Se ejecuta contra el contenedor "api-carga" (sin rate limiting), porque el
// tope de 120 peticiones por minuto por IP haria que todo midiera 429:
//   docker run --rm --network sugoinote-pruebas_red-pruebas \
//     -v "${PWD}/pruebas/carga:/scripts" -e BASE_URL=http://api-carga:8080 \
//     grafana/k6 run /scripts/carga.js
// ─────────────────────────────────────────────────────────────
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:5266';
const CLAVE = 'CargaSegura.2026';

export const options = {
  scenarios: {
    navegacion: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '60s', target: 20 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // Criterios de aceptacion de la prueba de carga.
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const cabecerasJson = { 'Content-Type': 'application/json' };

export function setup() {
  const sello = `${Date.now()}.${Math.floor(Math.random() * 10000)}`;
  const correo = `carga.${sello}@sugoinote.test`;

  const registro = http.post(
    `${BASE}/api/auth/registrar`,
    JSON.stringify({ nombreCompleto: 'Estudiante de carga', correoElectronico: correo, claveAcceso: CLAVE }),
    { headers: cabecerasJson, tags: { endpoint: 'registro' } },
  );
  if (registro.status !== 200) throw new Error(`No se pudo registrar el usuario de carga: ${registro.status}`);

  const token = registro.json('token');
  const autorizacion = { headers: { Authorization: `Bearer ${token}` }, tags: { endpoint: 'setup' } };

  // Datos base: sin apuntes, el listado responde vacio y no mide lo mismo.
  for (let i = 0; i < 5; i++) {
    http.post(
      `${BASE}/api/apuntes`,
      JSON.stringify({
        tituloNota: `Apunte de carga ${i + 1}`,
        contenidoTexto: `<h2>Tema ${i + 1}</h2><p>Contenido de prueba para medir el listado con datos reales.</p>`,
        materiaId: null,
        nuevaMateriaNombre: i < 2 ? 'Carga' : null,
      }),
      { ...autorizacion, headers: { ...autorizacion.headers, ...cabecerasJson } },
    );
  }

  return { headers: { Authorization: `Bearer ${token}` } };
}

export default function (datos) {
  const h = datos.headers;

  group('consultas del estudiante', () => {
    const apuntes = http.get(`${BASE}/api/apuntes`, { headers: h, tags: { endpoint: 'listar-apuntes' } });
    check(apuntes, { 'listar apuntes responde 200': (r) => r.status === 200 });

    const materias = http.get(`${BASE}/api/apuntes/materias`, { headers: h, tags: { endpoint: 'listar-materias' } });
    check(materias, { 'listar materias responde 200': (r) => r.status === 200 });

    const perfil = http.get(`${BASE}/api/perfil`, { headers: h, tags: { endpoint: 'perfil' } });
    check(perfil, { 'perfil responde 200': (r) => r.status === 200 });

    const comunidad = http.get(`${BASE}/api/comunidad`, { headers: h, tags: { endpoint: 'comunidad' } });
    check(comunidad, { 'comunidad responde 200': (r) => r.status === 200 });
  });

  // Pausa entre "pantallas", como el uso real de la app.
  sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data) {
  return {
    '/scripts/resumen-carga.json': JSON.stringify(data, null, 2),
    stdout: `\nCarga terminada: ${data.metrics.http_reqs.values.count} peticiones, ${data.metrics.http_req_failed.values.rate.toFixed(2)} % de errores\n`,
  };
}
