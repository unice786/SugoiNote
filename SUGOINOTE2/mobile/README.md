# SugoiNote Móvil

App móvil de **SugoiNote** (Expo SDK 57 + React Native 0.86 + Expo Router), que
replica el diseño y las funciones de la versión web consumiendo la misma API
REST (`/api/*`). **No incluye módulos de administración** (eso es solo de la web).

> Estado general: **Fases 0 a 8 completadas.** La Fase 8 dejó `eas.json` y la URL de
> la API configurables; compilar y subir a las tiendas (`eas build` / `eas submit`)
> requiere una cuenta de Expo y la API publicada (ver "Build y publicación").

---

## Cómo levantar el entorno

Requisitos: Node.js y la API del backend corriendo (ver `../README.md`).

```powershell
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Iniciar Expo
npm start            # luego escanea el QR con Expo Go
# o
npx expo start --android
npx expo start --ios
```

En el celular (misma red Wi-Fi que la PC) abre `exp://<TU-IP-DE-RED>:8081`.

> **Importante:** `react` debe permanecer en `19.2.3` (versión que exige Expo 57).
> Usar `19.3.1` rompe `expo-doctor`.

### Configurar la URL de la API

En desarrollo, edita `src/api/client.ts` → constante `API_BASE_POR_DEFECTO` (por
defecto `http://192.168.0.38:5199`). Para un teléfono físico usa la **IP local de la
PC** y arranca el backend con el perfil `celular` (escucha en `0.0.0.0`).
`iniciar.ps1` compara esa IP con la tuya y avisa si cambió.

Para builds de producción, **no edites el código**: define la variable de entorno
`EXPO_PUBLIC_API_URL` con la API publicada (ya viene en los perfiles `preview` y
`production` de `eas.json`). La prioridad es
`EXPO_PUBLIC_API_URL` → `API_BASE_POR_DEFECTO`.

### Comandos de verificación

```bash
npx tsc --noEmit     # typecheck
npx expo-doctor      # diagnostica dependencias y configuración
npx expo lint        # lint
```

---

## Build y publicación (EAS)

Preparación (una sola vez, requiere cuenta de Expo):

```powershell
npm install -g eas-cli      # o usa: npx eas-cli@latest <comando>
eas login
cd mobile
eas init                    # crea/liga el proyecto y añade extra.eas.projectId
```

- `development` — `developmentClient: true` + distribución interna. Requiere
  `npx expo install expo-dev-client` **antes** del primer build (no afecta al flujo
  normal con Expo Go).
- `preview` — **APK** de distribución interna para probar en dispositivos reales.
- `production` — binario para tienda; `autoIncrement` sube `versionCode` /
  `buildNumber` en EAS.
- La URL de la API se inyecta con `EXPO_PUBLIC_API_URL` (definida en los perfiles
  `preview` y `production` de `eas.json`).

```powershell
eas build -p android --profile preview      # APK interno
eas build -p android --profile production   # AAB/AAB para Play Store
eas build -p ios --profile production       # IPA para App Store
eas submit -p android --profile production
eas submit -p ios --profile production
```

> La API debe estar publicada y accesible por HTTPS para que `preview`/`production`
> conecten; hasta entonces esos perfiles no enlazarán con el backend.

---

## Stack y decisiones técnicas

| Área | Elección | Motivo |
|------|----------|--------|
| Navegación | **Expo Router** (file-based) | Rutas por archivo en `src/app/`, igual que la estructura de la web |
| Datos remotos | **@tanstack/react-query** | Caché, reintentos y estados de carga/error |
| Diseño | **Tokens JS portados de `wwwroot/css/_tokens.css`** | Mismo look claro/oscuro que la web (57 variables) |
| Editor de apuntes | **WebView** cargando `/Apuntes/Editor/{id}` | Reutiliza el editor rich-text de la web |
| PDF | **expo-print** | Exportar resúmenes/exámenes |
| Gráficos | **react-native-chart-kit** | Estadísticas del perfil |
| Sesión | **JWT en expo-secure-store** | Igual que la web (auth dual cookie/JWT) |

---

## Estructura

```
mobile/
├─ app.json                 Config Expo (scheme "sugoinote", plugins)
├─ eas.json                 Perfiles EAS (development / preview / production)
├─ index.ts                 Entry point (Expo Router)
├─ tsconfig.json            TypeScript
├─ src/
│  ├─ app/                  Rutas (Expo Router)
│  │  ├─ _layout.tsx        Providers raíz: SafeArea → Query → Theme → Auth → Toast → Stack
│  │  ├─ (auth)/            Pantallas de sesión
│  │  │  ├─ _layout.tsx
│  │  │  ├─ login.tsx
│  │  │  └─ register.tsx
│  │  └─ (tabs)/            Pestañas principales
│  │     ├─ _layout.tsx     Tab bar con Ionicons
│  │     ├─ index.tsx       Inicio (apuntes recientes) — funcional
│  │     ├─ apuntes/        Módulo Apuntes (Fase 1) — index/nuevo/[id] + Stack
│  │     ├─ resumenes/      Módulo Resúmenes IA (Fase 2) — index/generar/[apunteId] + Stack
│  │     ├─ examenes/       Módulo Exámenes (Fase 3) — index/generar/[examenId] + Stack
│  │     ├─ chat.tsx        Módulo Chat IA (Fase 4) — conversación con el asistente
│  │     ├─ comunidad/      Módulo Comunidad (Fase 5) — index/[id] + Stack
│  │     └─ perfil/         Módulo Perfil (Fase 6-7) — index/editar + Stack
│  ├─ api/
│  │  └─ client.ts          Cliente HTTP + DTOs + módulos de endpoints
│  ├─ components/
│  │  └─ ui/                Button, Input, Card, Modal, Badge, Avatar, Spinner, Toast,
│  │                        Skeleton, ListSkeleton, EmptyState, ErrorState
│  ├─ hooks/
│  │  └─ useAuth.ts         AuthProvider + useAuth()
│  ├─ theme/
│  │  ├─ tokens.ts          lightTokens / darkTokens (ThemeTokens)
│  │  └─ ThemeProvider.tsx  ThemeProvider + useTheme() (persiste en SecureStore)
│  ├─ utils/
│  │  └─ resumenHtml.ts     Envuelve el HTML del resumen con estilos del tema / PDF
│  └─ declarations.d.ts     Tipado de expo-router/entry
```

---

## Fase 0 — Fundación (COMPLETADA)

Checklist verificado con `npx tsc --noEmit` sin errores.

### 1. Dependencias

Instaladas con `npx expo install` (resuelve versiones compatibles con SDK 57) y
`--legacy-peer-deps` para npm. Incluye: `expo-router`, `@tanstack/react-query`,
`@expo/vector-icons`, `@react-navigation/bottom-tabs`, `expo-secure-store`,
`expo-image-picker`, `expo-print`, `expo-sharing`, `react-native-webview`,
`react-native-chart-kit`, `react-native-svg`, `react-native-reanimated`,
`react-native-worklets`, `react-native-gesture-handler`, `react-native-screens`,
`react-native-safe-area-context`.

### 2. Sistema de diseño

- `src/theme/tokens.ts` — interface `ThemeTokens` + `lightTokens`/`darkTokens`,
  con las 57 variables de la web (colores, `onSurface02-15`, `scrim25-70`,
  radios, etc.).
- `src/theme/ThemeProvider.tsx` — `ThemeProvider` + `useTheme()`; soporta
  `light` / `dark` / `system` y persiste la preferencia en SecureStore
  (`sugoinote.theme_preference`).

### 3. Cliente de API

- `src/api/client.ts` — `api<T>()` con manejo de JWT (`Bearer`), lectura/escritura
  del token en SecureStore, `ErrorApi` (con `status`) y un mensaje claro cuando
  no hay conexión con `API_BASE`.
- DTOs completos: `Estudiante`, `ApunteDto`, `ResumenDto`, `ExamenDetalleDto`,
  `PostDto`, `PerfilDto`, etc.
- Módulos: `auth`, `apuntes`, `resumenes`, `examenes`, `chat`, `comunidad`,
  `perfil`.

### 4. Componentes UI base

`src/components/ui/` con barrel `index.ts`:

| Componente | Variantes / props clave |
|------------|------------------------|
| `Button` | `primary` · `secondary` · `ghost` · `danger` · `outline`; `sm/md/lg`; `loading`, `icon`, `fullWidth` |
| `Input` | `label`, `error`, `leftIcon`, `rightIcon`, `passwordToggle` |
| `Card` | `elevated` · `surface` · `inset`; `onPress` opcional |
| `Modal` | `visible`, `title`, `onClose`, `fullWidth` |
| `Badge` | `default` · `accent` · `success` · `warning` · `danger` · `info` · `outline` |
| `Avatar` | `xs/sm/md/lg/xl`; iniciales con color derivado del nombre |
| `Spinner` | `sm/md/lg`; `label` |
| `Toast` | `ToastProvider` + `useToast()` (`show/success/error/info/warning`) |

### 5. Expo Router y layouts

- `src/app/_layout.tsx` — orden de providers: `SafeAreaProvider` →
  `QueryClientProvider` → `ThemeProvider` → `AuthProvider` → `ToastProvider` →
  `Stack`. `QueryClient` con `staleTime` 5 min y `retry: 1`.
- `src/app/(tabs)/_layout.tsx` — 7 pestañas con `Ionicons` y colores del tema:
  Inicio, Apuntes, Resúmenes, Chat IA, Exámenes, Comunidad, Perfil.
- `src/app/(auth)/_layout.tsx` + `login.tsx` + `register.tsx` — réplica del
  diseño de la web.
- `src/app/(tabs)/index.tsx` — Inicio **funcional**: consume `apuntes.listar()`
  con React Query, muestra apuntes recientes en grid, estados de carga/error/vacío.
- `src/app/(tabs)/apuntes/` — módulo **Apuntes** funcional (Fase 1): `_layout.tsx`
  (Stack anidado), `index.tsx` (listado + búsqueda + filtro), `nuevo.tsx` (crear)
  y `[id].tsx` (editor WebView + eliminar).
- `src/app/(tabs)/resumenes/` — módulo **Resúmenes IA** funcional (Fase 2):
  `_layout.tsx` (Stack anidado), `index.tsx` (listado), `generar.tsx` (selector de
  apunte + generación con IA) y `[apunteId].tsx` (detalle + exportar PDF).
- `src/app/(tabs)/examenes/` — módulo **Exámenes** funcional (Fase 3):
  `_layout.tsx` (Stack anidado), `index.tsx` (listado + nota), `generar.tsx` (tipo +
  cantidad + apunte) y `[examenId].tsx` (resolver + calificar + ver resultado).
- `src/app/(tabs)/chat.tsx` — módulo **Chat IA** funcional (Fase 4): conversación con
  burbujas usuario/IA, indicador "Escribiendo…", autoscroll, limpiar y manejo de errores.
- `src/app/(tabs)/comunidad/` — módulo **Comunidad** funcional (Fase 5):
  `_layout.tsx` (Stack anidado), `index.tsx` (feed paginado + crear post/encuesta en
  modales) y `[id].tsx` (detalle + votar/responder/eliminar).
- `src/app/(tabs)/perfil/` — módulo **Perfil** funcional (Fase 6-7): `_layout.tsx`
  (Stack anidado), `index.tsx` (datos del estudiante, cambio de avatar, estadísticas +
  gráfico y selector de tema) y `editar.tsx` (edición de nombre/correo).

### 6. Autenticación

- `src/hooks/useAuth.ts` — `AuthProvider` + `useAuth()` con `user`, `loading`,
  `login`, `logout`, `refreshUser`. Restaura la sesión leyendo el token y
  llamando a `/api/auth/me` + `/api/perfil`.

### 7. Configuración Expo (`app.json`)

- `name: "SugoiNote"`, `scheme: "sugoinote"`, `userInterfaceStyle: "automatic"`.
- Plugins: `expo-router`, `expo-status-bar`, `expo-sharing`,
  `expo-image-picker` (con permiso de fotos).
- Bundle/package: `com.sugoinote.app`.

### Correcciones aplicadas durante la Fase 0

| Problema | Solución |
|----------|----------|
| `expo-router/entry` sin tipos (TS7016) | `src/declarations.d.ts` |
| `@expo/vector-icons` no instalado | `npx expo install @expo/vector-icons` |
| Tipos de UI no exportados (`index.ts`) | `export interface *Props` en cada componente |
| `CustomTabBar` con tipos incompatibles | Se reescribió con `Tabs` + `screenOptions` de Expo Router |
| `react` 19.3.1 rompía `expo-doctor` | Fijado en `19.2.3` |

---

## Variables del tema (referencia)

Los tokens provienen de `../wwwroot/css/_tokens.css`. Algunos grupos:

- **Superficies:** `bgApp`, `bgSurface`, `bgElevated`, `bgInset`, `bgInset2`,
  `bgSidebar`.
- **Texto:** `textPrimary`, `textSecondary`, `textMuted`.
- **Acento/estado:** `accent`, `accentHover`, `accentTint`, `accentContrast`,
  `success`, `warning`, `danger`, `info` (+ `*Soft`).
- **Overlays:** `onSurface02` … `onSurface15`, `scrim25` … `scrim70`.
- **Bordes/radios:** `borderDefault`, `borderSubtle`, `borderStrong`,
  `radiusSm/Md/Lg`.

---

## Fase 1 — Apuntes (COMPLETADA)

- Listado con búsqueda por título y filtro por materia (chips horizontales).
- Crear apunte (título + materia existente o nueva).
- Editor de bloques vía **WebView** (`/Apuntes/Editor/{id}`) con autoguardado
  redirigido a `POST /api/apuntes/{id}/autosave` (JWT, sin antifalsificación).
- Eliminar con confirmación.
- Rutas: `src/app/(tabs)/apuntes/index.tsx` (listado, con `_layout.tsx` tipo Stack),
  `.../nuevo.tsx` y `.../[id].tsx`.
- Endpoints: `apuntes.listar`, `obtener`, `crear`, `autoSave`, `eliminar` y
  `materias` (nuevo `GET /api/apuntes/materias` para el filtro/selector).

---

## Fase 2 — Resúmenes IA (COMPLETADA)

- Listar resúmenes existentes (`resumenes.listar`) con estado vacío/carga/error y
  refresco al recuperar el foco.
- Generar: selector de apunte (`resumenes.apuntesDisponibles`) con búsqueda,
  confirmación y **overlay de carga** mientras la IA responde (`resumenes.generar`).
- Detalle del resumen renderizado en **WebView** con estilos del tema (HTML
  sanitizado por el backend) y exportación a **PDF** con `expo-print` + `expo-sharing`.
- Rutas: `src/app/(tabs)/resumenes/index.tsx`, `.../generar.tsx` y `.../[apunteId].tsx`
  (con `_layout.tsx` tipo Stack).
- Helper `src/utils/resumenHtml.ts` reutilizado por la vista y el PDF.
- Endpoints: `resumenes.listar`, `obtener`, `apuntesDisponibles`, `generar`.

---

## Fase 3 — Exámenes (COMPLETADA)

- Listar exámenes con la nota y estado (Aprobado ≥70 / Regular ≥50 / Reprobado /
  Pendiente) vía `examenes.listar`.
- Generar: selección de **tipo** (opción múltiple / verdadero o falso), **cantidad**
  (5-20) y **apunte** con búsqueda, y **overlay de carga** mientras la IA crea las
  preguntas (`examenes.generar`).
- Resolver y calificar: se marcan las opciones y se entrega con validación de que
  todas estén respondidas (`examenes.calificar`); el resultado muestra la nota, el
  resumen aciertos/errores y las respuestas correctas resaltadas (`examenes.obtener`
  solo devuelve `esLaCorrecta` tras calificar).
- Rutas: `src/app/(tabs)/examenes/index.tsx`, `.../generar.tsx` y `.../[examenId].tsx`
  (con `_layout.tsx` tipo Stack). El selector de apuntes reutiliza `apuntes.listar`
  (no hizo falta endpoint nuevo).
- Endpoints: `examenes.listar`, `obtener`, `generar`, `calificar`.

---

## Fase 4 — Chat IA (COMPLETADA)

- Interfaz de conversación con burbujas (usuario/IA), estado "Escribiendo…",
  autoscroll al final, botón para limpiar y manejo de errores con toast + burbuja.
- Historial **en memoria** (el backend no persiste conversaciones) e instrucción al
  assistente con contexto de los apuntes del estudiante resuelto por el servidor.
- Ruta: `src/app/(tabs)/chat.tsx` (pantalla única, sin Stack propio).
- Endpoints: `chat.enviar`.
- **No se implementó adjuntar imágenes:** el endpoint `POST /api/chat/enviar`
  (`ApiChatController`) solo acepta `mensaje` y pasa `null` en el parámetro de imagen,
  a diferencia del controlador web (`/Chat/Enviar`) que sí admite `imagen`. Para
  habilitarlo habría que extender el DTO de la API y el cliente.

---

## Fase 5 — Comunidad (COMPLETADA)

- Feed **paginado** de publicaciones (`comunidad.listar`) con páginas de 20,
  búsqueda local por título/detalle/autor, `RefreshControl` y refresco al
  recuperar el foco (`useInfiniteQuery` + "Cargar más").
- Crear **pregunta** (`comunidad.crearPost`) o **encuesta** (`comunidad.crearEncuesta`)
  desde modales: opciones dinámicas (mín. 2) y conmutador "una opción por votante".
- Imagen de portada opcional con **`expo-image-picker`** (se envía como *data-URI*
  base64, que el sanitizador del backend acepta) y vista previa.
- Detalle (`comunidad.obtener`): portada, autor y fecha; en encuestas, opciones con
  barras de progreso y votación (`comunidad.votar`, con desvoto); en preguntas,
  formulario para responder (`comunidad.responder`) y listado de respuestas.
- Eliminar publicación propia (`comunidad.eliminar`) con confirmación; el botón
  solo aparece cuando `esMio`.
- Rutas: `src/app/(tabs)/comunidad/index.tsx` y `.../[id].tsx` (con `_layout.tsx`
  tipo Stack).
- Endpoints: `comunidad.listar`, `obtener`, `crearPost`, `crearEncuesta`,
  `responder`, `votar`, `eliminar`. La API (`ApiComunidadController`) ahora también
  devuelve `imagenUrl` y `esMio`.

---

## Fase 6 — Perfil (COMPLETADA)

- Datos del estudiante (`perfil.obtener`) con avatar (o iniciales), nombre, correo y
  fecha de alta.
- Edición de nombre/correo (`perfil.actualizar`) en un modal con validación y manejo
  de errores del servidor.
- Cambio de foto (`perfil.actualizarFoto`) con `expo-image-picker` (data-URI JPEG/PNG),
  recorte cuadrado y refresco del avatar.
- Tarjetas de estadísticas: apuntes, resúmenes, exámenes, publicaciones, materias y
  promedio.
- Gráfico de **barras** (`react-native-chart-kit` + `react-native-svg`) con la
  actividad general.
- Selector de tema (claro/oscuro/sistema) con `useTheme().setPreference` y cierre de
  sesión con confirmación.
- Backend: `PerfilService`/`ApiPerfilController` ahora calculan y devuelven
  `TotalResumenes` (apuntes con resumen IA) y `TotalPublicaciones` (posts del foro).

---

## Fase 7 — Pantallas de detalle y pulido (COMPLETADA)

- Perfil convertido a carpeta con Stack (`perfil/_layout.tsx` + `index.tsx`) y la
  edición movida a su propia ruta (`perfil/editar.tsx`) con validación y refresco
  del usuario autenticado.
- Componentes compartidos de estado en `components/ui`: `Skeleton`/`ListSkeleton`
  (shimmer animado), `EmptyState` y `ErrorState`.
- Estados de carga/error/vacío unificados en Inicio, Apuntes, Resúmenes, Exámenes,
  Comunidad y Perfil; pull-to-refresh real (`isFetching`) en Inicio.
- Accesibilidad: `accessibilityRole`/`accessibilityLabel` en tarjetas y botones
  solo-icono (volver, limpiar búsqueda, quitar imagen, cerrar modal) y `hitSlop`
  ampliado a tamaños táctiles.

---

## Fase 8 — Build y publicación (CONFIGURADA)

- `eas.json` con perfiles `development` (dev client + APK interno), `preview`
  (APK de distribución interna) y `production` (`autoIncrement` de
  `versionCode`/`buildNumber`), más un perfil `submit.production`.
- `app.json` ya define `ios.bundleIdentifier` y `android.package`
  (`com.sugoinote.app`), `scheme` y el plugin `expo-font`.
- URL de la API parametrizada: `EXPO_PUBLIC_API_URL` (en los perfiles EAS) →
  `API_BASE_POR_DEFECTO` en `client.ts`; `iniciar.ps1` adaptado a la nueva constante.
- Dependencias alineadas con SDK 57 (`npx expo install --fix` + `expo-font`);
  `npx expo-doctor` pasa 21/21.

> Los comandos `eas build`/`eas submit` en sí requieren una cuenta de Expo
> (`eas login` + `eas init`) y la API publicada; quedan documentados arriba.

---

## Bloqueadores conocidos

- **No se puede ejecutar la app todavía** sin `ConnectionStrings:DefaultConnection`
  (Azure SQL) y `Jwt:Key` (≥ 32 chars) configurados en los *User Secrets* del
  backend; `Program.cs` falla al arrancar si faltan. Hay que obtener los secretos
  de quien entregó el sistema.
- El editor de la web es rich-text; en el móvil se embebe vía **WebView**
  (`/Apuntes/Editor/{id}`) para conservar el formato (resuelto en Fase 1).

---

## Solución de problemas

| Síntoma | Causa / solución |
|---------|------------------|
| Spinner infinito | La API no responde en `API_BASE`; verifica IP, Wi-Fi y que la API esté encendida |
| `401` al abrir pantallas | Token vencido; la app lo borra y debes volver a iniciar sesión |
| `expo-doctor` alerta por `react` | Debe ser `19.2.3`; ejecuta `npx expo install --fix` |
| Módulo nativo no disponible en Expo Go | Requiere development build: `npx expo run:android` o `eas build --profile development` |
