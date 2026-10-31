# Pruebas de SugoiNote

Todo se ejecuta en Docker; el equipo anfitrion solo tiene Docker Desktop, Node (para los generadores de reportes) y Edge/Brave (para armar el PDF y tomar capturas).

## Que hay en cada carpeta

| Carpeta | Contenido |
|---|---|
| `postman/` | Generador de la coleccion a partir del OpenAPI y la coleccion ya generada (35 peticiones, 140 aserciones). |
| `carga/` | Scripts de k6 (`carga.js`, `estres.js`), lanzador `ejecutar.mjs` y resumenes de cada corrida. |
| `e2e/` | Runner de los 5 flujos de negocio por HTTP (`flujos.mjs`). |
| `uat/` | Runner de los 9 criterios de aceptacion (`casos.mjs`). |
| `seguridad/` | Configuracion de OWASP ZAP, hook de autenticacion y los reportes HTML/JSON del escaneo. |
| `jira/` | Alta de casos e incidencias en Jira, capturas de pantalla y export de los casos. |
| `informes/` | Generadores de los reportes HTML, el documento final y el PDF. |

Los resultados crudos (TRX, JSON, dashboards, capturas de los reportes nativos) se escriben en `artifacts/pruebas/`, que no se versiona.

## Como se corre cada suite

```powershell
# 1. Entorno (SQL Server + API con la misma imagen que produccion)
docker compose up -d --build

# 2. Unitarias .NET (159 pruebas)
docker compose run --rm tests

# 3. Componentes React Native (16 pruebas)
docker run --rm -v "${PWD}/mobile:/app" -v "sugoinote-mobile-nm:/app/node_modules" -w /app node:22 `
  npx jest --ci --coverage --json --outputFile=/app/resultados.json

# 4. API con Newman (imagen con el reporter htmlextra)
docker build -t sugoinote-newman:pruebas pruebas/postman
docker run --rm --network sugoinote-pruebas_red-pruebas `
  -v "${PWD}/pruebas/postman:/etc/newman" -v "${PWD}/artifacts/pruebas/api:/salida" `
  sugoinote-newman:pruebas run SugoiNote-API-Completa.postman_collection.json `
  --env-var baseUrl=http://api:8080 -r cli,json,htmlextra `
  --reporter-json-export /salida/resultados.json `
  --reporter-htmlextra-export /salida/newman-report.html

# 5. E2E y UAT (el comando exacto esta en la cabecera de cada script)
docker run --rm --network sugoinote-pruebas_red-pruebas -v "${PWD}:/trabajo" -w /trabajo `
  node:22-bookworm node pruebas/e2e/flujos.mjs
docker run --rm --network sugoinote-pruebas_red-pruebas -v "${PWD}:/trabajo" -w /trabajo `
  -e BASE_URL=http://api:8080 node:22-bookworm node pruebas/uat/casos.mjs

# 6. Carga y estres (perfil "carga": misma API con el rate limiting apagado)
docker compose --profile carga up -d api-carga
node pruebas/carga/ejecutar.mjs carga
node pruebas/carga/ejecutar.mjs estres

# 7. Seguridad (OWASP ZAP)
docker run --rm --network sugoinote-pruebas_red-pruebas -v "${PWD}/pruebas/seguridad:/zap/wrk" `
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://api:8080 -r zap-baseline.html -J zap-baseline.json
docker run --rm --network sugoinote-pruebas_red-pruebas -v "${PWD}/pruebas/seguridad:/zap/wrk" `
  ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://api:8080/swagger/v1/swagger.json `
  -f openapi -r zap-api.html -J zap-api.json
```

El escaneo activo de la API necesita un token: `zap-hook.py` lo inyecta con la regla Replacer de ZAP.

## Como se arma el informe

```powershell
node pruebas/informes/reporte-dotnet.mjs
node pruebas/informes/reporte-jest.mjs
node pruebas/informes/reporte-newman.mjs
node pruebas/informes/reporte-k6.mjs
node pruebas/informes/reporte-zap.mjs

# Capturas de los reportes nativos (requiere playwright-core)
node pruebas/informes/capturar-nativos.mjs

# Documento final + PDF
node pruebas/informes/reporte-final.mjs
node pruebas/informes/generar-pdf.mjs
```

El PDF queda en `artifacts/Reporte-Ejecucion-Pruebas-SugoiNote.pdf` y lleva portada, indice con numeracion real, enlaces, casos de Jira con sus capturas, los ocho reportes (cada uno con la captura de su reporte nativo), hallazgos y conclusiones.

## Jira

`pruebas/jira/crear-casos.mjs` crea las tareas (`UNI-01`, `CMP-01`, `API-01`, ...), les pone las etiquetas `tipo:*` y `resultado:*`, agrega el comentario con la evidencia y las pasa a **Listo**. Tambien registra las incidencias con su descripcion y su correccion.

`pruebas/jira/capturas.mjs` abre el navegador con un perfil aparte para tomar las capturas del proyecto; requiere que alguien inicie sesion una vez en esa ventana.

## Convenciones

- Los commits siguen el formato `SG[1] Michael Sanchez: <descripcion>`.
- Ningun resultado se escribe a mano: las cifras del informe salen de los archivos que deja cada herramienta.
- Un caso con defecto real se registra como `FAIL` en Jira y como incidencia; no se cambia el resultado para que la tabla se vea mejor.
