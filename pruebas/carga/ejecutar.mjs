// ─────────────────────────────────────────────────────────────
// Ejecuta las pruebas de carga y estres con k6 en Docker y guarda, ademas del
// resumen de k6, el dashboard HTML nativo de la herramienta y la duracion real
// de la corrida (k6 v2 ya no incluye "state" en el resumen).
//
// Uso:
//   node pruebas/carga/ejecutar.mjs carga
//   node pruebas/carga/ejecutar.mjs estres
// ─────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..', '..');
const salida = join(raiz, 'artifacts', 'pruebas', 'rendimiento');
mkdirSync(salida, { recursive: true });

const RED = 'sugoinote-pruebas_red-pruebas';
const BASE = 'http://api-carga:8080';

function correr(script, resumen, dashboard, extra = []) {
  const argumentos = [
    'run', '--rm',
    '--network', RED,
    '-v', `${join(raiz, 'pruebas', 'carga')}:/scripts`,
    '-v', `${salida}:/salida`,
    '-e', `BASE_URL=${BASE}`,
    '-e', 'K6_WEB_DASHBOARD=true',
    '-e', `K6_WEB_DASHBOARD_EXPORT=/salida/${dashboard}`,
    ...extra,
    'grafana/k6', 'run', `--summary-export=/salida/${resumen}`, `/scripts/${script}`,
  ];

  const inicio = Date.now();
  execFileSync('docker', argumentos, { stdio: 'inherit' });
  const segundos = (Date.now() - inicio) / 1000;

  // El resumen de k6 se copia tambien a pruebas/carga (versionado) y se le
  // agrega la duracion medida para que los reportes muestren el dato real.
  const origen = join(salida, resumen);
  const datos = JSON.parse(readFileSync(origen, 'utf8'));
  datos.duracionMedida = Number(segundos.toFixed(1));
  const destino = join(aqui, resumen);
  writeFileSync(destino, JSON.stringify(datos, null, 2), 'utf8');
  writeFileSync(origen, JSON.stringify(datos, null, 2), 'utf8');
  console.log(`\n${resumen}: ${segundos.toFixed(1)} s`);
}

const modo = process.argv[2] ?? 'carga';

if (modo === 'carga') {
  correr('carga.js', 'resumen-carga.json', 'k6-carga.html');
} else if (modo === 'estres') {
  for (const nivel of [50, 100, 200, 400]) {
    correr('estres.js', `resumen-estres-${nivel}.json`, `k6-estres-${nivel}.html`, ['-e', `NIVEL=${nivel}`]);
  }
} else {
  console.error('Modo desconocido. Usa "carga" o "estres".');
  process.exit(1);
}

if (!existsSync(join(salida, 'k6-carga.html'))) {
  console.warn('Aviso: k6 no genero el dashboard HTML (revisa la version de la imagen).');
}
