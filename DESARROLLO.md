# DESARROLLO · Informe técnico

> **Audiencia:** equipo de desarrollo de SugoiNote.
> **Objetivo:** documentar **qué se hizo**, **por qué** y **cómo** en la
> preparación para producción, para que cualquiera pueda continuar el trabajo
> sin preguntar. La visión de producto está en [`README.md`](README.md).

---

## Índice

1. [Estado de las fases](#1-estado-de-las-fases)
2. [Resumen de la iteración](#2-resumen-de-la-iteración)
3. [Bloque 1.1 — Seguridad de la configuración](#3-bloque-11--seguridad-de-la-configuración)
4. [Bloque 1.2 — Migración de IA a Google Gemini](#4-bloque-12--migración-de-ia-a-google-gemini)
5. [Bloque 1.3 — Configuración de producción](#5-bloque-13--configuración-de-producción)
6. [Bugs corregidos de paso](#6-bugs-corregidos-de-paso)
7. [Arquitectura del código y convenciones](#7-arquitectura-del-código-y-convenciones)
8. [Configuración y secretos](#8-configuración-y-secretos)
9. [Verificación](#9-verificación)
10. [Despliegue en MonsterASP](#10-despliegue-en-monsterasp)
11. [Registro de errores encontrados](#11-registro-de-errores-encontrados)
12. [Deuda técnica y pendientes](#12-deuda-técnica-y-pendientes)

---

## 1. Estado de las fases

### Fase 1 — API / Backend

| Bloque | Descripción | Estado |
|---|---|:---:|
| 1.1 | Secretos fuera del repositorio y plantilla de producción | ✅ Hecho |
| 1.2 | Migración de la IA de Anthropic a Google Gemini | ✅ Hecho |
| 1.3 | Configuración de producción (Hangfire, hosting, exclusiones) | ✅ Hecho |
| 1.4 | Adelgazar `wwwroot` (Bootstrap sobrante, ~5.8 MB) | ⏸️ Omitido a propósito |
| 1.5 | Despliegue en MonsterASP (Git deploy) | 🟡 En curso |

> **Por qué se omitió 1.4:** el recorte de archivos de `wwwroot/lib/bootstrap`
> tiene riesgo de romper estilos con poca ganancia funcional. Se deja para un
> cambio aislado y verificable con calma.

### Fase 2 — App móvil

| Bloque | Descripción | Estado |
|---|---|:---:|
| 2.1 | Instalación/alineación de dependencias (`npm install --legacy-peer-deps`) | ⏳ Pendiente |
| 2.3 | Build de la APK con EAS (`mobile/eas.json`) | ⏳ Pendiente |
| 2.4 | Pruebas en dispositivo | ⏳ Pendiente |

---

## 2. Resumen de la iteración

El trabajo de esta iteración persiguió **dejar el backend listo para producción**
resolviendo tres problemas que lo impedían:

1. **La IA no funcionaba.** La cuenta de Anthropic no tenía saldo y los modelos
   configurados no existían, así que resúmenes, exámenes y chat quedaban sin
   respuesta. → Se migró a **Google Gemini** (plan gratuito).
2. **Dos bugs que rompían funcionalidad clave.** Los resúmenes salían vacíos y el
   alta de apuntes por la API móvil permitía **XSS almacenado**.
3. **El proyecto no estaba preparado para publicarse.** Código muerto (Hangfire),
   la app móvil se colaba en cada publicación y las notas de despliegue no
   existían.

---

## 3. Bloque 1.1 — Seguridad de la configuración

**Problema.** `appsettings.json` y la plantilla de producción contenían
**credenciales reales** (cadena de conexión con contraseña y API key de IA) dentro
de un repositorio **público**.

**Qué se hizo**

- `appsettings.json` quedó con los valores **vacíos**. Los secretos reales viven en
  *User Secrets* en desarrollo y en **variables de entorno** en producción.
- Se reescribió `appsettings.Production.example.json` como plantilla **sin
  credenciales**: solo marcadores de posición, la sección `IA`, `App:UrlBase` y
  notas de despliegue.
- Se documentó en el README de qué variable de entorno corresponde cada valor.

**Decisión: no reescribir el historial de Git.** Los secretos antiguos seguirán en
commits pasados. La mitigación correcta es **rotarlos** (ver §12), no reescribir
el historial (que además rompería clones existentes).

---

## 4. Bloque 1.2 — Migración de IA a Google Gemini

### 4.1 Motivo

La capa anterior (`Services/Anthropic/`) apuntaba a Anthropic, cuya cuenta **no
tenía saldo**. El resultado: resúmenes, exámenes y chat devolvían error. Se
migró a **Google Gemini** por su **plan gratuito** y su soporte de visión y JSON.

### 4.2 Diseño

Se conservó la **misma abstracción** para no tocar los servicios consumidores:

```csharp
public interface IIaClient
{
    Task<string>   TextoAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);
    Task<JsonNode> JsonAsync(string system, string prompt, CancellationToken ct = default, bool rapido = false);
    Task<string>   TextoConImagenAsync(string system, string prompt, string dataUri, CancellationToken ct = default);
}
```

- **Implementación:** `Services/Ia/GeminiClient.cs` (nuevo).
- **Eliminado:** toda la carpeta `Services/Anthropic/`.
- **Renombrado:** `AnthropicOptions` → `IaOptions`, sección de configuración
  `"Anthropic"` → `"IA"`.
- **Servicios que la consumen:** `ResumenService`, `ChatService`, `ExamenService`
  (solo cambió el tipo inyectado, no su lógica).

### 4.3 Detalles de implementación relevantes

| Aspecto | Decisión |
|---|---|
| **Modelos** | Principal `gemini-3.8-flash`; rápido `gemini-3.1-flash-lite` (usado por el chat y tareas cortas) |
| **Modo JSON** | `generationConfig.responseMimeType = "application/json"` en las llamadas que esperan JSON |
| **Visión** | Imágenes por `inlineData` (mimeType + base64) en `TextoConImagenAsync` |
| **Bloques de razonamiento** | `LeerTexto` **descarta** las partes con `thought: true`; son el borrador interno del modelo y no deben mostrarse |
| **Extracción de JSON** | `ExtraerJson` quita las vallas de código markdown y recorta al **primer objeto/array balanceado**, respetando comillas y escapes |
| **Errores de usuario** | `TraducirError` convierte cada código en un mensaje apto para mostrar: `429`, `5xx`, `401/403`, `400 "API key"`, `404` y el texto `"no longer available"` |
| **Filtros de contenido** | Se detectan por `finishReason` (`SAFETY`, `PROHIBITED_CONTENT`, `BLOCKLIST`) y por `promptFeedback.blockReason` |
| **Sin clave configurada** | Falla con un mensaje claro en vez de una excepción opaca |

> **Nota:** `Gemini` responde **400** tanto por una clave inválida como por una
> petición mal formada; se distinguen inspeccionando el mensaje (`"API key"`).

### 4.4 Resiliencia (Polly)

Configurada en `Program.cs` con `AddStandardResilienceHandler`:

| Parámetro | Valor | Razón |
|---|---|---|
| `MaxRetryAttempts` | 2 | Suficiente para fallos transitorios |
| `AttemptTimeout` | 120 s | Se **midió un resumen real tardando 79 s**; 120 s da margen |
| `TotalRequestTimeout` | 175 s | Tope global, por debajo del `HttpClient.Timeout` |
| `CircuitBreaker.SamplingDuration` | 240 s | Polly exige ventana ≥ 2× el timeout de intento |
| `IaOptions.Timeout` (HttpClient) | 180 s | Por encima de Polly, para que el error lo dé Polly con su mensaje |

**Decisión clave — qué se reintenta y qué no:**

- ❌ **No se reintenta `429`.** Cada reintento **consume más cuota** del plan
  gratuito. Se devuelve el mensaje *"límite alcanzado"* al usuario de inmediato.
- ❌ **No se reintentan los timeouts.** Si una llamada ya tardó 120 s, hacer
  esperar 120 s más es peor que devolver el error.
- ✅ Solo se reintentan **errores de red** (`HttpRequestException`) y **`5xx`**.

> **Deuda conocida:** los modelos con razonamiento son lentos. Una mejora futura
> es limitar `thinkingConfig` para reducir la latencia (no aplicado aún).

---

## 5. Bloque 1.3 — Configuración de producción

### 5.1 Hangfire (código muerto) — eliminado

Se comprobó que **no había `AddHangfireServer` ni dashboard**: el registro de
Hangfire no hacía nada y solo añadía dependencias.

- Paquetes `Hangfire.AspNetCore` y `Hangfire.SqlServer` eliminados del `.csproj`.
- Bloque `AddHangfire(...)` eliminado de `Program.cs`.
- `global using Hangfire;` y `global using Hangfire.Dashboard;` eliminados de
  `GlobalUsings.cs`.
- Verificado: **no queda ninguna DLL de Hangfire** en el publish.

### 5.2 Hosting en IIS

Se añadió `<AspNetCoreHostingModel>InProcess</AspNetCoreHostingModel>` al
`.csproj`. El `web.config` generado sale con `hostingModel="InProcess"`, que es lo
recomendado para MonsterASP y evita tener que reenviar cabeceras.

### 5.3 Exclusión de la app móvil del publish

**Problema:** el SDK Web incluía por defecto los `*.json` del proyecto Expo
(`package.json`, `package-lock.json` de 440 KB, `tsconfig.json`, `app.json`,
`eas.json`) en cada publicación.

**Solución** en `SUGOINOTE2.csproj`:

```xml
<ItemGroup>
  <Compile Remove="mobile\**" />
  <Content Remove="mobile\**" />
  <None Remove="mobile\**" />
  <EmbeddedResource Remove="mobile\**" />

  <!-- La plantilla es solo para el desarrollador -->
  <Content Remove="appsettings.Production.example.json" />
</ItemGroup>
```

### 5.4 Verificación del publish

| Comprobación | Resultado |
|---|---|
| `mobile/` en el publish | ❌ ausente ✅ |
| DLLs de Hangfire | ❌ ausentes ✅ |
| `web.config` | `hostingModel="InProcess"` ✅ |
| `appsettings.json` presente | ✅ |
| Peso total del publish | **43.44 MB** |
| `dotnet build` Debug y Release | 0 errores / 0 advertencias |

---

## 6. Bugs corregidos de paso

### 6.1 Resúmenes vacíos (`La IA devolvió un resumen vacío`)

**Causa raíz.** En **HtmlSanitizer v9** las colecciones de `HtmlSanitizerOptions`
arrancan **vacías**, no pobladas con los valores por defecto. El saneador
`SugoiHtmlSanitizer` partía de `new HtmlSanitizerOptions()`, así que **borraba
todas las etiquetas y su contenido**. Solo sobrevivían `div`/`table`/`span`
(las que se añadían a mano), por eso pasó desapercibido.

**Solución.** Partir de `HtmlSanitizerDefaults` y luego añadir lo propio del editor.

### 6.2 XSS almacenado en el alta de apuntes

**Causa.** `ApunteService.CrearRapidoAsync` (la que usa la API móvil) guardaba el
HTML **sin sanear**, a diferencia de `CrearAsync`/`AutoSaveAsync`.

**Solución.** Se añadió `sanitizer.Sanitize(...)` para alinearla con el resto.
Se dejó un **log de diagnóstico** en `ResumenService` cuando el saneado queda
vacío (útil para detectar regresiones de este tipo).

---

## 7. Arquitectura del código y convenciones

### Capas

```
Controllers/         reciben la petición, delegan y devuelven la respuesta
   ├─ (raíz)         MVC de la web (cookie)
   └─ Api/           REST para el móvil (JWT) · /api/*
Services/            TODA la lógica de negocio
   ├─ Apuntes/ Auth/ Chat/ Comunidad/ Examenes/ Perfiles/ Resumenes/
   ├─ Ia/            cliente de IA (detrás de IIaClient)
   └─ Common/        opciones, utilidades, IHtmlSanitizer, ICurrentUser
Models/              entidades EF Core + DbContext
Views/               Razor (web)
wwwroot/             css, js, librerías vendorizadas
mobile/              app Expo (no forma parte del publish de la API)
```

### Convenciones

- **Los controladores no contienen lógica.** Orquestan y devuelven.
- **Web y API comparten servicios.** Un cambio de comportamiento se hace una vez.
- **Aislamiento por propietario.** Los servicios filtran por el usuario actual:
  un recurso ajeno devuelve **404**, no 403 (no se filtra la existencia).
- **Todo HTML se sanea** antes de persistir (`IHtmlSanitizer`).
- **Configuración tipada** con `IOptions<T>` y `ValidateOnStart`.
- **Comentarios en español** explicando el *porqué*, no el *qué*.

---

## 8. Configuración y secretos

### Validación de arranque

`Program.cs` valida con `ValidateOnStart` las opciones críticas: si faltan, **la
app no arranca** (a propósito, para no fallar en caliente).

| Clave | Obligatoria | Notas |
|---|:---:|---|
| `ConnectionStrings:DefaultConnection` | ✅ | Si falta, el proceso termina con código 1 |
| `IA:ApiKey` | ✅ | Necesaria para cualquier función de IA |
| `Jwt:Key` | ✅ | Mínimo **32 caracteres** (HMAC-SHA256) |
| `App:UrlBase` | ➖ | Para construir enlaces absolutos (correos) |
| `Email:*` | ➖ | Ver aviso abajo |

### Aviso sobre el correo

`Email:SoloLog` está en **`true`**: en ese modo el correo de restablecimiento
**se escribe en el log** en vez de enviarse. Si se quiere envío real en
producción, hay que poner `Email__SoloLog=false` **y** configurar el SMTP
(`Email__Host`, `Email__Port`, `Email__User`, `Email__Password`).

### Desarrollo

```bash
cd SUGOINOTE2
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "..."
dotnet user-secrets set "IA:ApiKey" "<API_KEY_GEMINI>"
dotnet user-secrets set "Jwt:Key" "<32+ CARACTERES ALEATORIOS>"
```

---

## 9. Verificación

### Compilar y publicar

```bash
cd SUGOINOTE2
dotnet build -c Release          # debe dar 0 errores / 0 advertencias
dotnet publish -c Release -o out # comprobar que no aparece mobile/ ni Hangfire
```

### Smoke test (arranque y DI)

```bash
dotnet run --launch-profile celular --no-build
# en otra terminal:
curl http://localhost:5199/health          # -> 200 Healthy
curl http://localhost:5199/swagger/v1/swagger.json  # -> 200
```

### Prueba funcional de IA

Con una API key válida: login → generar examen → chat → generar resumen →
comprobar que el HTML conserva `h2/p/strong/ul/li/table` y que un `<script>`
inyectado se elimina.

---

## 10. Despliegue en MonsterASP

Publicación por **deploy desde Git**: la plataforma clona el repositorio y publica
el proyecto.

### Prerrequisitos

1. **Runtime .NET 10** disponible en el sitio (confirmar en el panel).
2. **Permisos DDL** para el usuario de SQL: la app ejecuta `MigrateAsync()` al
   arrancar y necesita crear/actualizar tablas.
3. Repositorio accesible (público = sin token; **plan Free = pull manual**).

### Variables de entorno (formato `Sección__Clave`)

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Server=...;Database=...;User Id=...;Password=...;TrustServerCertificate=True
IA__ApiKey=<API_KEY_GEMINI>
Jwt__Key=<32+ caracteres aleatorios>
App__UrlBase=https://sugoinote.runasp.net
```

Y, opcionalmente, las `Email__*` si se quiere correo real.

### Pasos

1. Commit y **push** a `main`.
2. En MonsterASP, conectar el repositorio y seleccionar el proyecto
   (`SUGOINOTE2/SUGOINOTE2.csproj`; si el panel no soporta el formato `.slnx`,
   elegir el `.csproj` directamente).
3. Definir las variables de entorno del apartado anterior.
4. Publicar y comprobar `/health` en `https://sugoinote.runasp.net/health`.

> El `web.config` se genera con `InProcess`; no hace falta configurarlo a mano.

---

## 11. Registro de errores encontrados

Histórico de incidencias relevantes y su corrección (incluye las de fases
anteriores, para no perder el contexto):

| # | Error | Causa | Solución |
|---|---|---|---|
| 1 | **Votar en encuestas daba 500** | EF con `EnableRetryOnFailure` prohíbe transacciones iniciadas por el usuario | Se envolvieron las 3 transacciones en `CreateExecutionStrategy().ExecuteAsync(...)` |
| 2 | **No se podían subir PDF** | La CSP no tenía `worker-src`; pdf.js crea su worker desde un `Blob`, que `default-src 'self'` bloquea | Se añadió `worker-src 'self' blob:;` |
| 3 | **Inputs del login descentrados** | `.input-wrapper > i` en `position:absolute` **sin `top`** | Se añadió `top:50%` + `translateY(-50%)` |
| 4 | **Swagger documentaba 0 endpoints** | Los controladores usan routing convencional, que el ApiExplorer no documenta | Se creó la capa `/api/*` con attribute routing |
| 5 | **Swagger no compilaba** | En el SDK el namespace pasó de `Microsoft.OpenApi.Models` a `Microsoft.OpenApi` | Se corrigió el `using` |
| 6 | **6 tokens de color sin definir** | `site.css` usaba `--purple-glow`, `--on-surface-15`, `--scrim-*` sin declararlos | Se declararon en claro y oscuro |
| 7 | **13 usos de tokens viejos** | Sobraban `--text-main` y `--border` de los `:root` antiguos | Se renombraron a `--text-primary` / `--border-default` |
| 8 | **Archivos con doble codificación** | `site.css` quedó en mojibake (`diseÃ±o`) tras un `Set-Content` de PowerShell | Reparación selectiva validada, UTF-8 correcto |
| 9 | **`_tokens.css` duplicado** | Copia huérfana no referenciada: dos fuentes de verdad | Se eliminó |
| 10 | **Vulnerabilidad de gravedad alta** | `System.Security.Cryptography.Pkcs 10.0.0` (GHSA-846f-f764-76mx) | Actualizada a `10.0.13` |
| 11 | **La app no arrancaba en el celular** | La API escuchaba solo en `localhost` | Perfil `celular` que abre en `0.0.0.0` |
| 12 | **Spinner infinito en el móvil** | Si el almacenamiento se colgaba, `cargando` nunca se apagaba | Tope de 8 s con `Promise.race` |
| 13 | **Consola inundada de SQL** | Serilog ignoraba la sección `Logging` y escupía cada comando EF | Niveles mínimos por categoría |
| 14 | **El móvil no arrancaba en Expo Go** | En iOS con SDK 57 hay que iniciar sesión en Expo Go **y** en la CLI con la misma cuenta | Documentado en el README |
| 15 | **Lint rompía el `Skeleton`** | `useRef(...).current` leído durante el render dispara `react-hooks/refs` | `Animated.Value` creado con `useState` perezoso |
| 16 | **Listado de exámenes no tipaba** | `ExamenResumenDto` expone `tituloApunte`, no `tituloNota` | Se corrigió el `accessibilityLabel` |
| 17 | **`expo-doctor` con 2 fallos** | Faltaba el peer `expo-font` de `@expo/vector-icons` y parches de `expo`/`expo-router` | `npx expo install expo-font` + `npx expo install --fix` |
| 18 | **La IA no funcionaba** | La cuenta de Anthropic no tenía saldo y los modelos configurados no existían | Migración a **Google Gemini** (`Services/Ia/GeminiClient.cs`) |
| 19 | **Los resúmenes salían vacíos** | En HtmlSanitizer v9 las colecciones de `HtmlSanitizerOptions` arrancan vacías | `SugoiHtmlSanitizer` parte de `HtmlSanitizerDefaults` |
| 20 | **XSS almacenado en el alta de apuntes** | `ApunteService.CrearRapidoAsync` guardaba HTML sin sanear | Se añadió `sanitizer.Sanitize(...)` |

---

## 12. Deuda técnica y pendientes

### 🔴 Crítico (bloquea la seguridad)

- **Rotar secretos expuestos.** La contraseña de MonsterASP SQL y la API key de IA
  estuvieron en el historial de Git (repositorio público). Hay que **regenerarlas**:
  1. Cambiar la contraseña del usuario de SQL en MonsterASP.
  2. Crear una **API key nueva** de Gemini.
  3. Actualizarlas en *User Secrets* y en las variables de entorno del servidor.

### 🟡 En curso / pendiente

- **Despliegue (1.5):** confirmar runtime .NET 10 y **permisos DDL** del usuario de
  SQL (la app ejecuta `MigrateAsync()` al arrancar).
- **Fase 2 (app móvil):** instalar dependencias y lanzar el **build de la APK** con
  EAS (requiere cuenta de Expo).
- **Build a producción:** el móvil apunta a `EXPO_PUBLIC_API_URL`, que debe
  apuntar a `https://sugoinote.runasp.net` en el perfil de producción.

### 🟢 Mejoras futuras (no urgentes)

- **Latencia de IA:** limitar `thinkingConfig` para reducir los ~79 s de un
  resumen largo.
- **Adelgazar `wwwroot`** (bloque 1.4): recortar el Bootstrap sobrante
  (~5.8 MB) dejando solo el CSS en uso.
- **Cobertura de pruebas:** no hay proyecto de tests automatizados; la verificación
  actual es manual (build + smoke test + prueba funcional).

### ⚠️ Notas de entorno

- El **editor de bloques** de la web se embebe en el móvil vía **WebView**, por lo
  que se conserva el rich-text (no se degrada a texto plano).
- Las **claves de DataProtection** se persisten en la base de datos: así las
  sesiones sobreviven a los reinicios y despliegues. Requiere permisos de
  escritura en esa tabla.
