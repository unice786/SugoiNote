# SugoiNote

Plataforma de estudio para estudiantes: apuntes con editor, resúmenes y exámenes
generados con IA, chat de estudio y comunidad. Es un **proyecto integrador de tres
capas**:

| Capa | Tecnología | Carpeta |
|---|---|---|
| Backend | ASP.NET Core 10 (Web API + MVC) | raíz del proyecto |
| Frontend web | ASP.NET Core MVC + Bootstrap 5 | `Views/`, `wwwroot/` |
| Móvil | Expo SDK 57 / React Native 0.86 | `mobile/` |

La base de datos es **MonsterASP SQL** y ya está
desplegada en la nube. Las funciones de IA usan **Google Gemini** (Google AI Studio).

---

## Cómo levantar el entorno

```powershell
.\iniciar.ps1        # API + Expo en dos ventanas
.\reiniciar.ps1      # los para y los vuelve a levantar
.\detener.ps1        # los para
```

Para la web y la API: <http://localhost:5199> · Documentación: `/swagger`

Para el móvil, en Expo Go escribe `exp://<TU-IP-DE-RED>:8081` (celular y PC en
la misma WiFi). En desarrollo la URL de la API se ajusta en
`mobile/src/api/client.ts` (constante `API_BASE_POR_DEFECTO`; `iniciar.ps1` avisa
si tu IP cambió); en builds de EAS se define con la variable de entorno
`EXPO_PUBLIC_API_URL`.

---

## Qué se hizo

### Base y datos (F0)

- **Secretos fuera del repositorio.** `appsettings.json` quedó vacío y todo se
  guarda con *User Secrets* (`dotnet user-secrets`). Se creó
  `appsettings.Production.example.json` como plantilla para desplegar con
  variables de entorno.
- **Librerías vendorizadas** en `wwwroot/lib/`: `Mammoth` (DOCX), `pdf.js` y
  `DOMPurify`. Se quitaron jQuery, el JS duplicado de Bootstrap y `Alpine.js`
  (no referenciado) (−3.5 MB).
- **Migración baseline** de EF Core contra Azure SQL **sin perder datos**:
  2 estudiantes, 1 apunte y 1 materia intactos.

### Seguridad (F1)

- **Autenticación dual** con un *policy scheme*: la web usa cookie de sesión y
  el móvil usa JWT, con los mismos `[Authorize]` en todos los controladores.
- **Lockout**: 5 intentos y bloqueo de 10 minutos.
- **Rate limiting**: login 10/5 min, IA 20/min y global 120/min por IP.
- **Antifalsificación** global (`AutoValidateAntiforgeryToken`); la API JWT lo
  desactiva explícitamente con `[IgnoreAntiforgeryToken]`.
- **IDOR cerrado**: los servicios filtran por propietario, así que un recurso
  ajeno devuelve 404 y no 403.
- Cabeceras de seguridad + **CSP** y HSTS fuera de desarrollo.
- Restablecimiento de contraseña por **token de un solo uso** (30 min) con
  envío de correo por **MailKit**.

### Arquitectura (F2)

Modelos reescritos contra el esquema real de Azure SQL (los modelos mentían:
`MaterialID` en vez de `MateriaID`, ids `int` donde son `uniqueidentifier`).
Capa de servicios completa (`Services/`) con toda la lógica fuera de los
controladores, cliente de IA con Polly (reintentos + circuit breaker) y
sanitizado HTML con `HtmlSanitizer`.

### Modo claro (F4)

Sistema de tokens: 57 variables en `wwwroot/css/_tokens.css` con tema claro y
oscuro. `site.css` quedó **sin un solo color literal**. El tema se aplica antes
del primer pintado para evitar el parpadeo blanco.

### Accesibilidad y responsive (F5)

Enlace de salto, navegación por teclado con `:focus-visible`, `aria-current`,
etiquetas `for`, respeto a `prefers-reduced-motion` y hoja de impresión. Se
agregó el **botón de menú móvil**, que antes no existía: el sidebar se ocultaba
en pantallas chicas y no había forma de volver a abrirlo.

### API REST para el móvil (F6)

Seis controladores en `Controllers/Api/` (23 endpoints) que reutilizan los
mismos servicios que la web:

```
api/auth      registrar · login · me
api/apuntes   listar · crear · obtener · autosave · eliminar
api/resumenes listar · obtener · apuntes · generar
api/examenes  listar · generar · obtener · calificar
api/chat      enviar
api/comunidad listar · obtener · posts · encuestas · responder · votar
api/perfil    obtener · actualizar · foto
```

Documentados en `/swagger`.

### App móvil

Expo SDK 57 con **Expo Router** (rutas por archivos en `mobile/src/app/`),
7 pestañas, tema claro/oscuro, sesión con JWT en `expo-secure-store` y React Query
para datos remotos.

Completado (F0): sistema de diseño con tokens de la web, cliente API tipado,
componentes UI base, layouts de sesión/pestañas y pantalla de Inicio.

Completado (F1): módulo de **Apuntes** completo — listado con búsqueda y filtro por
materia, creación (materia existente o nueva), editor rich-text embebido vía
**WebView** (`/Apuntes/Editor/{id}`) con autoguardado y eliminación con confirmación.

Completado (F2): módulo de **Resúmenes IA** — listado, generación desde un apunte
(con estado de carga de la IA), detalle con HTML renderizado en WebView y export a PDF.

Completado (F3): módulo de **Exámenes** — listado con nota, generación (tipo, cantidad
y apunte), resolución con calificación y resultado con respuestas correctas resaltadas.

Completado (F4): módulo de **Chat IA** — conversación con burbujas, indicador
"Escribiendo…", historial en memoria, limpiar y manejo de errores.

Completado (F5): módulo de **Comunidad** — feed paginado, crear pregunta/encuesta
(con opciones e imagen de portada vía `expo-image-picker`), detalle con votar/responder
y eliminación de publicaciones propias.

Completado (F6): módulo de **Perfil** — datos y edición del estudiante, cambio de
avatar vía `expo-image-picker`, estadísticas + gráfico de barras
(`react-native-chart-kit`), selector de tema (claro/oscuro/sistema) y cierre de sesión.

Completado (F7): **rutas de detalle y pulido** — el Perfil pasó a carpeta con Stack y
la edición a su propia pantalla (`perfil/editar`); componentes compartidos de estado
(`Skeleton`/`ListSkeleton`, `EmptyState`, `ErrorState`); estados de carga/error/vacío
unificados en todas las pantallas y pull-to-refresh real en Inicio; accesibilidad
(`accessibilityLabel`/`accessibilityRole` y `hitSlop`) en tarjetas y botones solo-icono.

Completado (F8): **build y publicación (configurada)** — `eas.json` con perfiles
`development` (dev client + APK interno), `preview` (APK interno) y `production`
(`autoIncrement`), `ios.bundleIdentifier`/`android.package = com.sugoinote.app` y la
URL de la API parametrizada por `EXPO_PUBLIC_API_URL`. Dependencias alineadas con el
SDK 57 (`expo-font`, parches de `expo`/`expo-router`); `npx expo-doctor` pasa 21/21.
Falta ejecutar `eas build`/`eas submit`, que requieren cuenta de Expo y la API publicada.

> El detalle de todas las fases del móvil (hechas y la configuración de build) está en
> [`mobile/README.md`](mobile/README.md).

---

## Errores encontrados y corregidos

| # | Error | Causa | Qué se hizo |
|---|---|---|---|
| 1 | **Votar en encuestas daba 500** | EF con `EnableRetryOnFailure` prohíbe transacciones iniciadas por el usuario | Se envolvieron las 3 transacciones en `CreateExecutionStrategy().ExecuteAsync(...)` |
| 2 | **No se podían subir PDF** | La CSP no tenía `worker-src`; pdf.js crea su worker desde un `Blob` que `default-src 'self'` bloquea | Se añadió `worker-src 'self' blob:;` |
| 3 | **Inputs del login descentrados** | `.input-wrapper > i` estaba en `position:absolute` **sin `top`**, así que el icono no se centraba | Se añadió `top:50%` + `translateY(-50%)` |
| 4 | **Swagger documentaba 0 endpoints** | Los controladores usan *routing convencional*, que el ApiExplorer de MVC no documenta | Se creó la capa `/api/*` con *attribute routing* |
| 5 | **Swagger no compilaba** | En SDK 57 el namespace pasó de `Microsoft.OpenApi.Models` a `Microsoft.OpenApi` | Se corrigió el `using` |
| 6 | **6 tokens de color sin definir** | `site.css` usaba `--purple-glow`, `--on-surface-15` y `--scrim-*` sin declararlos; los fondos quedaban invisibles | Se declararon en claro y oscuro |
| 7 | **13 usos de tokens viejos** | Sobraban `--text-main` y `--border` de los `:root` antiguos ya eliminados | Se renombraron a `--text-primary` y `--border-default` |
| 8 | **Archivos con doble codificación** | `site.css` quedó en mojibake (`diseÃ±o`) tras un `Set-Content` de PowerShell | Reparación selectiva validada, UTF-8 correcto |
| 9 | **`_tokens.css` duplicado** | Copia huérfana no referenciada; dos fuentes de verdad | Se eliminó |
| 10 | **Vulnerabilidad de gravedad alta** | `System.Security.Cryptography.Pkcs 10.0.0` (GHSA-846f-f764-76mx) | Actualizada a `10.0.13` |
| 11 | **La app no arrancaba en el celular** | La API escuchaba solo en `localhost` | Perfil `celular` que abre en `0.0.0.0` |
| 12 | **Spinner infinito en el móvil** | Si el almacenamiento se colgaba, `cargando` nunca se apagaba | Tope de 8 s con `Promise.race` |
| 13 | **Consola inundada de SQL** | Serilog ignoraba la sección `Logging` y escupía cada comando EF | Niveles mínimos por categoría |
| 14 | **El móvil no arrancaba en Expo Go** | En iOS con SDK 57 hay que iniciar sesión en Expo Go **y** en la CLI con la misma cuenta | Documentado en el README |
| 15 | **Lint rompía el `Skeleton`** | `useRef(...).current` leído durante el render dispara `react-hooks/refs` | El `Animated.Value` se crea con `useState` perezoso |
| 16 | **Listado de exámenes no tipaba** | `ExamenResumenDto` expone `tituloApunte`, no `tituloNota` | Se corrigió el `accessibilityLabel` |
| 17 | **`expo-doctor` con 2 fallos** | Faltaba el peer `expo-font` de `@expo/vector-icons` y los parches de `expo`/`expo-router` | `npx expo install expo-font` + `npx expo install --fix` |
| 18 | **La IA no funcionaba** | La cuenta de Anthropic no tenía saldo y los modelos configurados (`claude-sonnet-5`) no existían | Se reemplazó la capa de IA por **Google Gemini** (`Services/Ia/GeminiClient.cs`): misma interfaz, modelos `gemini-3.8-flash` y `gemini-3.1-flash-lite`, plan gratuito, y traducción de errores 429/404/clave inválida |
| 19 | **Los resúmenes salían vacíos** (`La IA devolvió un resumen vacío`) | En HtmlSanitizer v9 las colecciones de `HtmlSanitizerOptions` arrancan **vacías**, no con los valores por defecto: el saneador borraba todas las etiquetas y su contenido. Solo sobrevivían `div`/`table`/`span` (las que se añadían a mano), por eso pasó desapercibido | `SugoiHtmlSanitizer` parte ahora de `HtmlSanitizerDefaults` y luego añade lo propio del editor |
| 20 | **XSS almacenado en el alta de apuntes** | `ApunteService.CrearRapidoAsync` (la que usa la API móvil) guardaba el HTML **sin sanear**, a diferencia de `CrearAsync`/`AutoSaveAsync` | Se añadió `sanitizer.Sanitize(...)` en `CrearRapidoAsync` |

---

## Pendientes

- **Rotar secretos.** La contraseña de MonsterASP SQL y la API key de IA estuvieron
  en el historial de git (el repositorio es público). Hay que regenerarlas.
- Publicar la API en MonsterASP (`sugoinote.runasp.net`, ya creado) con **Git deploy**:
  falta definir las variables de entorno (`ConnectionStrings__DefaultConnection`,
  `IA__ApiKey`, `Jwt__Key`, `App__UrlBase` y `Email__*`) y confirmar que el sitio
  corre sobre .NET 10.
- El editor de bloques de la web se embebe en el móvil vía **WebView**, por lo que
  se conserva el formato rich-text (no se degrada a texto plano).
- La app móvil tiene las **Fases 0 a 8** terminadas (la Fase 8 deja `eas.json` y la
  URL de API configurables; falta ejecutar los builds, que requieren cuenta de Expo)
  según [`mobile/README.md`](mobile/README.md).

---

## Estructura

```
SUGOINOTE2/
├─ Controllers/       MVC (web) y Api/ (REST)
├─ Services/          lógica de negocio por área
├─ Models/            entidades EF Core
├─ Migrations/        migración baseline
├─ Views/             vistas Razor
├─ wwwroot/           css, js, librerías vendorizadas
├─ mobile/            app Expo (ver mobile/README.md)
│  ├─ eas.json        perfiles EAS (development/preview/production)
│  ├─ src/app/        rutas (Expo Router): (auth), (tabs)
│  ├─ src/api/        cliente HTTP con JWT y DTOs
│  ├─ src/components/ componentes UI base
│  ├─ src/hooks/      useAuth (sesión JWT)
│  └─ src/theme/      tokens y ThemeProvider (claro/oscuro)
├─ iniciar.ps1 · reiniciar.ps1 · detener.ps1
└─ Program.cs
```