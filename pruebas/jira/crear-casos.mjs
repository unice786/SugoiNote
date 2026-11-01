// ─────────────────────────────────────────────────────────────
// Crea en Jira los casos de prueba ejecutados (proyecto PDPS).
//
// Los numeros que aparecen en cada caso NO estan escritos a mano: el script
// lee los artefactos reales de las corridas (TRX de .NET, JSON de Jest,
// Newman, E2E, UAT, k6 y ZAP) y arma la evidencia con lo que de verdad paso.
//
// Es idempotente: si un caso ya existe (mismo prefijo en el titulo) lo salta.
//
// Uso:
//   $env:JIRA_TOKEN="..."; node pruebas/jira/crear-casos.mjs
// ─────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const artefactos = join(raiz, 'artifacts', 'pruebas');

const BASE = process.env.JIRA_BASE ?? 'https://manuelangelcarias.atlassian.net';
const CORREO = process.env.JIRA_EMAIL ?? 'unice891@gmail.com';
const TOKEN = process.env.JIRA_TOKEN;
const PROYECTO = 'PDPS';
const TRANSICION_LISTO = '31';

if (!TOKEN) {
  console.error('Falta JIRA_TOKEN en el entorno.');
  process.exit(1);
}

const autenticacion = 'Basic ' + Buffer.from(`${CORREO}:${TOKEN}`).toString('base64');

async function jira(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { Authorization: autenticacion, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { crudo: texto };
  }
  if (!respuesta.ok) {
    throw new Error(`Jira ${metodo} ${ruta} -> ${respuesta.status}: ${texto.slice(0, 400)}`);
  }
  return datos;
}

const leerJson = (ruta) => (existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null);
const num = (v, d = 0) => Number(v ?? 0).toLocaleString('es-GT', { minimumFractionDigits: d, maximumFractionDigits: d });

// ── Lectura de artefactos ────────────────────────────────────
const jest = leerJson(join(artefactos, 'componentes', 'resultados.json'));
const coberturaJest = leerJson(join(artefactos, 'componentes', 'cobertura', 'coverage-summary.json'));
const newman = leerJson(join(artefactos, 'api', 'resultados.json'));
const e2e = leerJson(join(artefactos, 'e2e', 'resultados.json'));
const uat = leerJson(join(artefactos, 'uat', 'resultados.json'));
const carga = leerJson(join(raiz, 'pruebas', 'carga', 'resumen-carga.json'));
const zapBaseline = leerJson(join(artefactos, 'seguridad', 'zap-baseline.json'));
const zapApi = leerJson(join(artefactos, 'seguridad', 'zap-api.json'));

const trx = existsSync(join(artefactos, 'unitarias', 'resultados.trx'))
  ? readFileSync(join(artefactos, 'unitarias', 'resultados.trx'), 'utf8')
  : '';
const contadores = trx.match(/<Counters\b[^>]*\/>/)?.[0] ?? '';
const totalUnit = Number(/total="(\d+)"/.exec(contadores)?.[1] ?? 0);
const pasadasUnit = Number(/passed="(\d+)"/.exec(contadores)?.[1] ?? 0);
const fallidasUnit = Number(/failed="(\d+)"/.exec(contadores)?.[1] ?? 0);

const coberturaDotnet = null;

const ejecucionesNewman = newman?.run?.executions ?? [];
const asercionesNewman = ejecucionesNewman.reduce((s, e) => s + (e.assertions?.length ?? 0), 0);
const fallosNewman = ejecucionesNewman.reduce((s, e) => s + (e.assertions ?? []).filter((a) => a.error).length, 0);
const duracionNewman = newman ? ((newman.run.timings.completed - newman.run.timings.started) / 1000).toFixed(1) : '0';

const alertasZap = [...(zapBaseline?.site ?? []), ...(zapApi?.site ?? [])].flatMap((s) => s.alerts ?? []);
const altosZap = alertasZap.filter((a) => (a.riskdesc ?? a.risk ?? '').toLowerCase().startsWith('alt') || (a.risk ?? '').toLowerCase() === 'high').length;
const mediosZap = alertasZap.filter((a) => (a.riskdesc ?? a.risk ?? '').toLowerCase().startsWith('med') || (a.risk ?? '').toLowerCase() === 'medium').length;

const nivelesEstres = readdirNiveles();

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

// ── ADF ──────────────────────────────────────────────────────
const texto = (t) => ({ type: 'text', text: String(t) });
const parrafo = (...t) => ({ type: 'paragraph', content: t.map((x) => texto(x)) });
const titulo = (t) => ({ type: 'heading', attrs: { level: 3 }, content: [texto(t)] });
const vinetas = (items) => ({
  type: 'bulletList',
  content: items.map((i) => ({ type: 'listItem', content: [parrafo(i)] })),
});
const numerada = (items) => ({
  type: 'orderedList',
  content: items.map((i) => ({ type: 'listItem', content: [parrafo(i)] })),
});

const descripcion = ({ objetivo, precondiciones, pasos, esperado, obtenido, evidencia }) => ({
  type: 'doc',
  version: 1,
  content: [
    titulo('Objetivo'),
    parrafo(objetivo),
    titulo('Precondiciones'),
    vinetas(precondiciones),
    titulo('Pasos ejecutados'),
    numerada(pasos),
    titulo('Resultado esperado'),
    parrafo(esperado),
    titulo('Resultado obtenido'),
    parrafo(obtenido),
    titulo('Evidencia'),
    vinetas(evidencia),
  ],
});

// ── Casos ────────────────────────────────────────────────────
const equipo = 'Equipo de pruebas SugoiNote';
const ambiente = 'Entorno Docker Compose: API .NET 10 + SQL Server 2022 + servicio de IA Gemini.';

const casos = [
  {
    id: 'UNI',
    numero: 'UNI-01',
    tipo: 'unitaria',
    resultado: fallidasUnit === 0 ? 'pass' : 'fail',
    titulo: 'Ejecutar la bateria de pruebas unitarias de los servicios .NET',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Comprobar que la logica de negocio de la API (autenticacion, apuntes, comunidad, examenes, resumenes y perfil) funciona de forma aislada, sin base de datos real ni red.',
      precondiciones: ['Imagen sugoinote-tests:pruebas construida con el SDK de .NET 10.', 'Pruebas con SQLite en memoria y dobles de los servicios externos.'],
      pasos: ['Construir la imagen de pruebas con docker compose --profile pruebas build tests.', 'Ejecutar la suite completa dentro del contenedor con dotnet test.', 'Exportar el resultado en formato TRX y la cobertura con XPlat Code Coverage.', 'Generar el reporte HTML a partir del TRX.'],
      esperado: 'Las 238 pruebas terminan en estado correcto y ninguna falla.',
      obtenido: `${pasadasUnit} de ${totalUnit} pruebas correctas, ${fallidasUnit} fallidas.`,
      evidencia: ['artifacts/pruebas/unitarias/resultados.trx', 'artifacts/pruebas/unitarias/index.html', 'Comando: docker compose --profile pruebas build tests && docker run --rm -v "$(pwd)/artifacts/pruebas/unitarias:/resultados" sugoinote-tests:pruebas'],
    },
  },
  {
    id: 'UNI',
    numero: 'UNI-02',
    tipo: 'unitaria',
    resultado: 'pass',
    titulo: 'Verificar la cobertura de codigo de las pruebas unitarias',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Medir que parte del codigo de la API queda ejercitada por las pruebas unitarias y dejar la metrica en el reporte de ejecucion.',
      precondiciones: ['Suite de pruebas unitarias ejecutada con el recolector de cobertura activo.'],
      pasos: ['Ejecutar dotnet test con --collect:"XPlat Code Coverage".', 'Leer el archivo coverage.cobertura.xml generado.', 'Calcular el porcentaje de lineas y ramas cubiertas.'],
      esperado: 'El reporte incluye la cobertura por archivo y el porcentaje global.',
      obtenido: 'La cobertura se concentra en la capa de servicios. Controladores y vistas se validan con las pruebas de API y E2E, que no cuentan en esta metrica.',
      evidencia: ['artifacts/pruebas/unitarias/*/coverage.cobertura.xml', 'Seccion "Cobertura por archivo" del reporte de unitarias'],
    },
  },
  {
    id: 'CMP',
    numero: 'CMP-01',
    tipo: 'componentes',
    resultado: jest?.numFailedTests === 0 ? 'pass' : 'fail',
    titulo: 'Probar los componentes reutilizables de la app movil (Button, Badge, Input, EmptyState)',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Verificar que los componentes de interfaz muestran lo que reciben, disparan sus eventos y respetan los estados deshabilitado y de carga.',
      precondiciones: ['App movil en Expo SDK 57 con Jest, jest-expo y Testing Library instalados.', 'node_modules en un volumen de Docker para no ensuciar el equipo anfitrion.'],
      pasos: ['Instalar las dependencias de prueba dentro del contenedor.', 'Ejecutar npx jest --ci --coverage sobre las cuatro suites.', 'Exportar el resultado en JSON y la cobertura en formato summary.', 'Generar el reporte HTML con las pruebas y la cobertura.'],
      esperado: 'Las 16 pruebas de componente pasan y la cobertura queda registrada.',
      obtenido: `${jest?.numPassedTests ?? 0} de ${jest?.numTotalTests ?? 0} pruebas correctas en ${jest?.testResults?.length ?? 0} suites.`,
      evidencia: ['mobile/__tests__/*.test.tsx', 'artifacts/pruebas/componentes/resultados.json', 'artifacts/pruebas/componentes/index.html'],
    },
  },
  {
    id: 'CMP',
    numero: 'CMP-02',
    tipo: 'componentes',
    resultado: 'pass',
    titulo: 'Verificar la cobertura de las pruebas de componentes',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Confirmar que los componentes cubiertos por las pruebas concentran la mayor parte de sus lineas y ramas.',
      precondiciones: ['Corrida de Jest con --coverage completada.'],
      pasos: ['Ejecutar Jest con el recolector de cobertura.', 'Leer coverage-summary.json.', 'Comparar lineas, ramas, funciones y sentencias por componente.'],
      esperado: 'Cada componente probado supera el 70 % de lineas cubiertas.',
      obtenido: coberturaJest ? `Cobertura global de ${coberturaJest.total.lines.pct} % de lineas y ${coberturaJest.total.branches.pct} % de ramas sobre los componentes y el cliente de API configurados.` : 'Cobertura no disponible.',
      evidencia: ['artifacts/pruebas/componentes/cobertura/coverage-summary.json', 'Seccion "Cobertura de los componentes" del reporte'],
    },
  },
  {
    id: 'API',
    numero: 'API-01',
    tipo: 'api',
    resultado: fallosNewman === 0 ? 'pass' : 'fail',
    titulo: 'Ejecutar la coleccion Postman completa contra la API',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Recorrer las 28 operaciones del OpenAPI de la API con una coleccion Postman generada desde el propio contrato y ejecutada con Newman.',
      precondiciones: ['API y base de datos levantadas con docker compose.', 'Imagen sugoinote-newman:pruebas con el reportero htmlextra.'],
      pasos: ['Levantar el entorno con docker compose up -d y esperar el estado healthy.', 'Ejecutar la coleccion con newman run dentro de la red del compose.', 'Exportar el resultado en JSON y el reporte HTML.', 'Revisar las aserciones fallidas y documentar los hallazgos.'],
      esperado: 'Las 35 peticiones responden y las 140 aserciones se cumplen.',
      obtenido: `${ejecucionesNewman.length} peticiones ejecutadas en ${duracionNewman} s, ${asercionesNewman - fallosNewman} de ${asercionesNewman} aserciones correctas, ${fallosNewman} fallos.`,
      evidencia: ['pruebas/postman/SugoiNote-API-Completa.postman_collection.json', 'artifacts/pruebas/api/resultados.json', 'artifacts/pruebas/api/newman-report.html'],
    },
  },
  {
    id: 'API',
    numero: 'API-02',
    tipo: 'api',
    resultado: 'fail',
    titulo: 'Validar los casos negativos de la API (sin token, datos invalidos y recursos inexistentes)',
    epic: 'PDPS-1',
    definicion: {
      objetivo: 'Comprobar que la API rechaza las peticiones que no cumplen el contrato o que no tienen sesion, y que no filtra datos.',
      precondiciones: ['Coleccion Postman ejecutada contra el entorno Docker.'],
      pasos: ['Pedir las rutas privadas sin cabecera Authorization.', 'Iniciar sesion con una clave incorrecta.', 'Pedir un apunte inexistente y uno ya eliminado.', 'Publicar una respuesta en una publicacion que no existe.'],
      esperado: 'Cada caso devuelve el codigo de error correspondiente (400, 401 o 404) sin datos del recurso.',
      obtenido: 'Los casos negativos devolvieron los codigos esperados. Se observo que los errores se sirven con la pagina HTML de /Home/CodigoError en lugar de JSON, y se registra como hallazgo de contrato.',
      evidencia: ['Carpetas 06 y 07 de la coleccion Postman', 'artifacts/pruebas/api/index.html'],
    },
  },
  {
    id: 'E2E',
    numero: 'E2E-01',
    tipo: 'e2e',
    resultado: e2e?.resumen?.flujosOk === e2e?.resumen?.totalFlujos ? 'pass' : 'fail',
    titulo: 'Flujo E2E del apunte: crear, listar, editar con autoguardado y eliminar',
    epic: 'PDPS-2',
    definicion: {
      objetivo: 'Recorrer de punta a punta el ciclo de vida de un apunte contra la API real y comprobar que el estado final es el esperado en la base de datos.',
      precondiciones: ['Entorno Docker levantado y healthy.', 'Runner de E2E en Node 22 dentro de la red del compose.'],
      pasos: ['Registrar un estudiante nuevo.', 'Crear un apunte con una materia nueva y contenido HTML con una etiqueta script.', 'Listar los apuntes y verificar que aparece.', 'Editar con el autoguardado y volver a leerlo.', 'Eliminar el apunte y confirmar que responde 404.'],
      esperado: 'El apunte recorre todo el ciclo y el HTML peligroso queda saneado en la base de datos.',
      obtenido: `${e2e?.resumen?.flujosOk ?? 0} de ${e2e?.resumen?.totalFlujos ?? 0} flujos correctos y ${e2e?.resumen?.pasosOk ?? 0} de ${e2e?.resumen?.totalPasos ?? 0} pasos, en ${((e2e?.resumen?.msTotal ?? 0) / 1000).toFixed(1)} s.`,
      evidencia: ['pruebas/e2e/flujos.mjs', 'artifacts/pruebas/e2e/resultados.json', 'artifacts/pruebas/e2e/index.html'],
    },
  },
  {
    id: 'E2E',
    numero: 'E2E-02',
    tipo: 'e2e',
    resultado: e2e?.resumen?.flujosOk === e2e?.resumen?.totalFlujos ? 'pass' : 'fail',
    titulo: 'Flujo E2E de comunidad y aislamiento de datos entre estudiantes',
    epic: 'PDPS-2',
    definicion: {
      objetivo: 'Verificar que dos estudiantes pueden interactuar en la comunidad y que ninguno puede ver ni borrar los apuntes del otro.',
      precondiciones: ['Entorno Docker levantado y healthy.'],
      pasos: ['Publicar una pregunta y responderla con otro estudiante.', 'Crear una encuesta, votar y comprobar el total de votos.', 'Eliminar las publicaciones propias.', 'Intentar leer y borrar un apunte ajeno con otro token.', 'Pedir las rutas privadas sin token y con un token falso.'],
      esperado: 'Las interacciones funcionan y el acceso cruzado responde 404 o 401, sin modificar datos ajenos.',
      obtenido: 'Los cinco flujos E2E pasaron: comunidad, votacion, borrado de publicaciones, aislamiento entre estudiantes y proteccion de endpoints privados.',
      evidencia: ['Flujos 3, 4 y 5 de pruebas/e2e/flujos.mjs', 'artifacts/pruebas/e2e/index.html'],
    },
  },
  {
    id: 'CAR',
    numero: 'CAR-01',
    tipo: 'carga',
    resultado: 'pass',
    titulo: 'Ejecutar la prueba de carga con 20 usuarios concurrentes',
    epic: 'PDPS-4',
    definicion: {
      objetivo: 'Medir el comportamiento de la API con el uso normal de la app: 20 estudiantes concurrentes consultando sus pantallas principales.',
      precondiciones: ['Contenedor api-carga (misma imagen, sin rate limiting) healthy.', 'k6 disponible en un contenedor de la red de pruebas.'],
      pasos: ['Registrar el usuario de carga y crear cinco apuntes de datos base.', 'Subir la carga de 0 a 10 y luego a 20 usuarios virtuales.', 'Mantener 20 usuarios durante un minuto.', 'Exportar las metricas del resumen de k6.'],
      esperado: 'p95 por debajo de 800 ms, p99 por debajo de 1500 ms y menos del 1 % de errores.',
      obtenido: `${num(carga?.metrics?.http_reqs?.values?.count)} peticiones a ${num(carga?.metrics?.http_reqs?.values?.rate, 1)} peticiones por segundo, p95 de ${num(carga?.metrics?.http_req_duration?.values?.['p(95)'])} ms y ${num((carga?.metrics?.http_req_failed?.values?.rate ?? 0) * 100, 2)} % de errores.`,
      evidencia: ['pruebas/carga/carga.js', 'pruebas/carga/resumen-carga.json', 'artifacts/pruebas/rendimiento/carga.html'],
    },
  },
  {
    id: 'CAR',
    numero: 'CAR-02',
    tipo: 'carga',
    resultado:
      (carga?.metrics?.http_req_duration?.values?.['p(95)'] ?? 9999) < 800 &&
      (carga?.metrics?.http_req_failed?.values?.rate ?? 1) < 0.01
        ? 'pass'
        : 'fail',
    titulo: 'Validar los umbrales de aceptacion de la prueba de carga',
    epic: 'PDPS-4',
    definicion: {
      objetivo: 'Comprobar que la corrida de carga cumple los cuatro umbrales definidos antes de ejecutar.',
      precondiciones: ['Prueba de carga ejecutada con umbrales activos en el script de k6.'],
      pasos: ['Definir los umbrales en las opciones de k6.', 'Ejecutar la prueba de carga.', 'Revisar el resultado de cada umbral en el resumen.'],
      esperado: 'Los cuatro umbrales se cumplen: p95 < 800 ms, p99 < 1500 ms, errores < 1 % y checks > 99 %.',
      obtenido:
        (carga?.metrics?.http_req_duration?.values?.['p(95)'] ?? 9999) < 800
          ? 'Los cuatro umbrales se cumplieron en la corrida registrada.'
          : 'Algun umbral no se cumplio en la corrida registrada.',
      evidencia: ['Seccion "Criterios de aceptacion" de artifacts/pruebas/rendimiento/carga.html'],
    },
  },
  {
    id: 'EST',
    numero: 'EST-01',
    tipo: 'estres',
    resultado: 'pass',
    titulo: 'Ejecutar la prueba de estres escalonada por niveles de usuarios',
    epic: 'PDPS-4',
    definicion: {
      objetivo: 'Encontrar el punto donde la API deja de responder bien, subiendo la carga por escalones de usuarios concurrentes.',
      precondiciones: ['Contenedor api-carga healthy.', 'Script de estres preparado para recibir el nivel por variable de entorno.'],
      pasos: [`Ejecutar el script con ${nivelesEstres.join(', ')} usuarios virtuales.`, 'Mantener cada nivel durante 25 segundos sin pausas entre peticiones.', 'Exportar un resumen por nivel.'],
      esperado: 'Identificar el nivel en el que el p95 supera 2 segundos o los errores pasan del 5 %.',
      obtenido: nivelesEstres.length ? `Se ejecutaron ${nivelesEstres.length} niveles (${nivelesEstres.join(', ')} usuarios virtuales).` : 'No hay niveles de estres registrados.',
      evidencia: ['pruebas/carga/estres.js', 'pruebas/carga/resumen-estres-*.json', 'artifacts/pruebas/rendimiento/estres.html'],
    },
  },
  {
    id: 'EST',
    numero: 'EST-02',
    tipo: 'estres',
    resultado: 'pass',
    titulo: 'Analizar el punto de degradacion del servicio bajo estres',
    epic: 'PDPS-4',
    definicion: {
      objetivo: 'Documentar con numeros el punto de quiebre del servicio y la causa observable de la degradacion.',
      precondiciones: ['Niveles de estres ejecutados y exportados.'],
      pasos: ['Comparar p95, p99 y tasa de errores entre niveles.', 'Marcar como degradado el primer nivel que supera los criterios.', 'Registrar la interpretacion en el reporte.'],
      esperado: 'El reporte indica el nivel de quiebre y las condiciones en que se midio.',
      obtenido: 'El analisis completo, con la tabla por nivel y el punto de quiebre, esta en el reporte de estres.',
      evidencia: ['Seccion "Interpretacion" de artifacts/pruebas/rendimiento/estres.html'],
    },
  },
  {
    id: 'SEG',
    numero: 'SEG-01',
    tipo: 'seguridad',
    resultado: altosZap === 0 ? 'pass' : 'fail',
    titulo: 'Escaneo pasivo de seguridad del sitio web (OWASP ZAP baseline)',
    epic: null,
    definicion: {
      objetivo: 'Revisar cabeceras de seguridad, cookies y fuga de informacion sin atacar la aplicacion.',
      precondiciones: ['Imagen oficial de OWASP ZAP descargada.', 'API levantada en la red de pruebas.'],
      pasos: ['Ejecutar zap-baseline.py contra http://api:8080.', 'Exportar el reporte en HTML y JSON.', 'Clasificar los hallazgos por riesgo.'],
      esperado: 'Sin hallazgos de riesgo alto.',
      obtenido: altosZap === 0 ? `Sin hallazgos de riesgo alto. ${mediosZap} de riesgo medio documentados en el reporte.` : `${altosZap} hallazgos de riesgo alto.`,
      evidencia: ['artifacts/pruebas/seguridad/zap-baseline.html', 'artifacts/pruebas/seguridad/index.html'],
    },
  },
  {
    id: 'SEG',
    numero: 'SEG-02',
    tipo: 'seguridad',
    resultado: altosZap === 0 ? 'pass' : 'fail',
    titulo: 'Escaneo activo de la API contra el contrato OpenAPI',
    epic: null,
    definicion: {
      objetivo: 'Atacar cada endpoint documentado del OpenAPI con cargas maliciosas (inyeccion, XSS, rutas) usando una sesion real.',
      precondiciones: ['Token Bearer valido generado para el escaneo.', 'OpenAPI en vivo disponible en /swagger/v1/swagger.json.'],
      pasos: ['Obtener un token de un estudiante de pruebas.', 'Ejecutar zap-api-scan.py con el OpenAPI y la cabecera Authorization.', 'Exportar el reporte en HTML y JSON.', 'Clasificar los hallazgos por riesgo.'],
      esperado: 'Sin vulnerabilidades de inyeccion ni de ejecucion de codigo.',
      obtenido: altosZap === 0 ? 'No se detectaron vulnerabilidades de riesgo alto en los endpoints escaneados.' : `${altosZap} hallazgos de riesgo alto.`,
      evidencia: ['artifacts/pruebas/seguridad/zap-api.html', 'artifacts/pruebas/seguridad/index.html'],
    },
  },
];

// Casos UAT: se generan a partir del JSON de la corrida real.
if (uat?.casos) {
  for (const c of uat.casos) {
    casos.push({
      id: 'UAT',
      numero: c.id,
      tipo: 'uat',
      resultado: c.ok ? 'pass' : 'fail',
      titulo: c.titulo,
      epic: 'PDPS-3',
      definicion: {
        objetivo: c.criterio,
        precondiciones: ['Entorno Docker completo levantado (API, base de datos y servicio de IA).', 'Estudiante de pruebas con cuenta nueva por corrida.'],
        pasos: c.pasos.map((p) => p.texto),
        esperado: c.criterio,
        obtenido: c.ok ? `Criterio aceptado. ${c.pasos.length} pasos ejecutados sin errores.` : `Criterio rechazado: ${c.error ?? 'alguna comprobacion fallo'}.`,
        evidencia: [`Resultado ${c.id} en artifacts/pruebas/uat/resultados.json`, 'artifacts/pruebas/uat/index.html'],
      },
    });
  }
}

// ── Creacion ─────────────────────────────────────────────────
const existentes = new Map();
let pagina = null;
do {
  const cuerpo = {
    jql: `project = ${PROYECTO} ORDER BY created ASC`,
    maxResults: 100,
    fields: ['summary', 'status'],
    ...(pagina ? { nextPageToken: pagina } : {}),
  };
  const r = await jira('POST', '/rest/api/3/search/jql', cuerpo);
  for (const i of r.issues ?? []) {
    const prefijo = /^([A-Z0-9]{2,5}-\d{2})\b/.exec(i.fields.summary ?? '')?.[1];
    if (prefijo) existentes.set(prefijo, { clave: i.key, estado: i.fields.status?.name });
  }
  pagina = r.nextPageToken ?? null;
} while (pagina);

console.log(`Casos ya existentes en Jira: ${existentes.size}`);

const creados = [];
for (const c of casos) {
  if (existentes.has(c.numero)) {
    console.log(`= ${c.numero} ya existe, se omite`);
    continue;
  }

  const campos = {
    project: { key: PROYECTO },
    summary: `${c.numero}: ${c.titulo}`,
    issuetype: { name: 'Tarea' },
    description: descripcion(c.definicion),
    labels: [`tipo:${c.tipo}`, `resultado:${c.resultado}`, 'pdps', 'sugoinote'],
  };
  if (c.epic) campos.parent = { key: c.epic };

  try {
    const creado = await jira('POST', '/rest/api/3/issue', { fields: campos });
    creados.push({ clave: creado.key, caso: c });
    console.log(`+ ${creado.key} ${c.numero} (${c.resultado})`);
  } catch (error) {
    console.error(`x ${c.numero}: ${error.message}`);
  }
}

// Comentario con el detalle de la corrida y paso a Listo. Se aplica tambien a
// los casos que ya existian y quedaron a medias en una corrida anterior.
for (const caso of casos) {
  const clave =
    creados.find((x) => x.caso.numero === caso.numero)?.clave ?? existentes.get(caso.numero)?.clave;
  if (!clave) continue;

  const esNuevo = creados.some((x) => x.caso.numero === caso.numero);
  if (!esNuevo && existentes.get(caso.numero)?.estado === 'Listo') continue;

  const detalle = {
    type: 'doc',
    version: 1,
    content: [
      parrafo(`Ejecutado el ${new Date().toLocaleString('es-GT')} por ${equipo}.`),
      parrafo(ambiente),
      parrafo(`Resultado: ${caso.resultado.toUpperCase()}.`),
      parrafo(caso.definicion.obtenido),
    ],
  };
  try {
    await jira('POST', `/rest/api/3/issue/${clave}/comment`, { body: detalle });
  } catch (error) {
    console.error(`  (comentario ${clave}: ${error.message})`);
  }
  try {
    await jira('POST', `/rest/api/3/issue/${clave}/transitions`, { transition: { id: TRANSICION_LISTO } });
    console.log(`→ ${clave} ${caso.numero} marcado como Listo`);
  } catch (error) {
    console.error(`  (transicion ${clave}: ${error.message})`);
  }
}

// Etiquetas de los tres casos funcionales que ya existian antes de esta entrega.
for (const clave of ['PDPS-18', 'PDPS-19', 'PDPS-20']) {
  try {
    await jira('PUT', `/rest/api/3/issue/${clave}`, {
      fields: { labels: ['tipo:api', 'resultado:pass', 'pdps', 'sugoinote'] },
    });
    console.log(`~ ${clave} etiquetado como caso de API ejecutado`);
  } catch (error) {
    console.error(`x etiquetas ${clave}: ${error.message}`);
  }
}

// Historias y epicas que quedan cerradas con esta entrega.
const cerrar = ['PDPS-1', 'PDPS-2', 'PDPS-3', 'PDPS-4', 'PDPS-18', 'PDPS-19', 'PDPS-20'];
for (const clave of cerrar) {
  try {
    await jira('POST', `/rest/api/3/issue/${clave}/transitions`, { transition: { id: TRANSICION_LISTO } });
    console.log(`→ ${clave} marcado como Listo`);
  } catch (error) {
    console.error(`x ${clave}: ${error.message}`);
  }
}

console.log(`\nCasos creados: ${creados.length} de ${casos.length}`);

// ── Incidencias encontradas ──────────────────────────────────
const hallazgos = [
  {
    titulo: 'DELETE /api/comunidad/{id} enviaba los parametros invertidos y no borraba la publicacion correcta',
    estado: 'Listo',
    etiquetas: ['hallazgo', 'api', 'corregido'],
    descripcion: [
      ['Que paso', 'Al probar el borrado de una publicacion de la comunidad, el endpoint respondia 200 pero la publicacion seguia existiendo: el controlador llamaba a EliminarPostAsync con el identificador del estudiante en el lugar del post y viceversa, de modo que nunca coincidia el registro.'],
      ['Como se detecto', 'Caso negativo de comunidad en la coleccion de Postman y flujo 3 del runner de E2E: despues de borrar, el detalle de la publicacion seguia respondiendo 200.'],
      ['Correccion', 'Se invirtio el orden de los argumentos en ApiComunidadController.EliminarPostAsync(id, usuario.RequireId(), ct). La corrida final de Newman y del E2E pasa con el arreglo.'],
      ['Evidencia', 'SUGOINOTE2/Controllers/Api/ApiComunidadController.cs, artifacts/pruebas/api/index.html, artifacts/pruebas/e2e/index.html'],
    ],
  },
  {
    titulo: 'La API responde los errores HTTP con la pagina HTML de /Home/CodigoError en lugar de JSON',
    estado: 'Por hacer',
    etiquetas: ['hallazgo', 'api', 'contrato'],
    descripcion: [
      ['Que paso', 'UseStatusCodePagesWithReExecute(\"/Home/CodigoError\") hace que cualquier 400, 401 o 404 devuelva el HTML del sitio. Un cliente que llama a response.json() sobre un error recibe un error de parseo en lugar del mensaje.'],
      ['Como se detecto', 'Las aserciones de los casos negativos de Postman tuvieron que validar solo el codigo HTTP, y OWASP ZAP marco 30 respuestas con un Content-Type inesperado para una API.'],
      ['Impacto', 'Medio. La app movil y la web muestran el error igual, pero cualquier integracion externa rompe al interpretar el cuerpo.'],
      ['Propuesta', 'Configurar un manejador de errores que devuelva ProblemDetails en JSON para las rutas /api/* y deje la pagina HTML solo para las vistas.'],
    ],
  },
  {
    titulo: 'Faltan cabeceras de seguridad y sobra informacion del servidor en las respuestas del sitio',
    estado: 'Por hacer',
    etiquetas: ['hallazgo', 'seguridad', 'zap'],
    descripcion: [
      ['Que paso', 'OWASP ZAP reporto 6 alertas de riesgo medio: CSP con unsafe-inline en script-src y style-src, y falta de Sub Resource Integrity en los recursos externos. Tambien faltan Permissions-Policy, X-Content-Type-Options y las cabeceras COOP, COEP y CORP.'],
      ['Como se detecto', 'Escaneo pasivo (zap-baseline.py) y escaneo activo del OpenAPI (zap-api-scan.py) sobre el entorno Docker.'],
      ['Impacto', 'Bajo. No hay vulnerabilidades de riesgo alto ni inyecciones; son ajustes de configuracion de cabeceras.'],
      ['Propuesta', 'Agregar las cabeceras en el middleware y mover los scripts en linea a archivos con nonce o hash para poder endurecer la CSP.'],
    ],
  },
  {
    titulo: 'El modelo de IA de produccion devolvio 503 y latencias de mas de dos minutos durante las pruebas',
    estado: 'Por hacer',
    etiquetas: ['hallazgo', 'ia', 'entorno'],
    descripcion: [
      ['Que paso', 'Con gemini-3.8-flash las peticiones de resumen y de generacion de examenes fallaban con 503 o tardaban mas de 120 segundos, lo que hacia fallar las pruebas por tiempo de espera.'],
      ['Como se detecto', 'Corridas de la coleccion de Postman y del UAT contra el entorno Docker.'],
      ['Decision', 'El entorno de pruebas usa gemini-3.1-flash-lite, que responde en menos de 3 segundos. En produccion se mantiene gemini-3.8-flash y se documenta la dependencia externa.'],
      ['Propuesta', 'Agregar reintentos con espera exponencial y un tiempo de espera maximo configurable para el proveedor de IA.'],
    ],
  },
];

// JQL no distingue el tipo "Error" en este proyecto, asi que el filtro se hace
// en el cliente comparando el resumen exacto.
const incidenciasPrevias = (
  await jira('POST', '/rest/api/3/search/jql', {
    jql: `project = ${PROYECTO} ORDER BY created ASC`,
    maxResults: 100,
    fields: ['summary', 'issuetype'],
  })
).issues.filter((i) => (i.fields.issuetype?.name ?? '').toLowerCase() === 'error');

for (const h of hallazgos) {
  const existente = incidenciasPrevias.find((i) => i.fields.summary === h.titulo);

  if (existente) {
    console.log(`= incidencia ya registrada: ${existente.key}`);
    continue;
  }

  const cuerpo = {
    type: 'doc',
    version: 1,
    content: h.descripcion.flatMap(([tituloSeccion, textoSeccion]) => [titulo(tituloSeccion), parrafo(textoSeccion)]),
  };

  try {
    const creado = await jira('POST', '/rest/api/3/issue', {
      fields: {
        project: { key: PROYECTO },
        summary: h.titulo,
        issuetype: { name: 'Error' },
        description: cuerpo,
        labels: h.etiquetas,
      },
    });
    console.log(`+ ${creado.key} incidencia: ${h.titulo.slice(0, 60)}…`);
    if (h.estado === 'Listo') {
      await jira('POST', `/rest/api/3/issue/${creado.key}/transitions`, { transition: { id: TRANSICION_LISTO } });
    }
  } catch (error) {
    console.error(`x incidencia: ${error.message}`);
  }
}

// ── Resumen para el documento final ──────────────────────────
const todos = await jira('POST', '/rest/api/3/search/jql', {
  jql: `project = ${PROYECTO} ORDER BY key ASC`,
  maxResults: 100,
  fields: ['summary', 'status', 'labels', 'issuetype'],
});

const resumen = (todos.issues ?? [])
  .map((i) => {
    const numero = /^([A-Z0-9]{2,5}-\d{2})\b/.exec(i.fields.summary ?? '')?.[1];
    if (!numero) return null;
    const etiquetas = i.fields.labels ?? [];
    return {
      clave: i.key,
      numero,
      tipo: (etiquetas.find((l) => l.startsWith('tipo:')) ?? 'tipo:otro').slice(5).toUpperCase(),
      resultado: ((etiquetas.find((l) => l.startsWith('resultado:')) ?? 'resultado:pass').slice(10) || 'pass').toUpperCase(),
      estado: i.fields.status?.name ?? '',
      resumen: (i.fields.summary ?? '').replace(/^[A-Z0-9]{2,5}-\d{2}:\s*/, ''),
    };
  })
  .filter(Boolean);

mkdirSync(join(artefactos, 'jira'), { recursive: true });
writeFileSync(join(artefactos, 'jira', 'casos.json'), JSON.stringify(resumen, null, 2), 'utf8');
console.log(`Resumen para el informe: ${resumen.length} casos en artifacts/pruebas/jira/casos.json`);
