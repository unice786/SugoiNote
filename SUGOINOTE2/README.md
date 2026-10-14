# SugoiNote

Plataforma de estudio para estudiantes: apuntes con editor, resúmenes y exámenes
generados con IA, chat de estudio y comunidad. Es un **proyecto integrador de tres
capas**:

| Capa | Tecnología | Carpeta |
|---|---|---|
| Backend | ASP.NET Core 10 (Web API + MVC) | raíz del proyecto |
| Frontend web | ASP.NET Core MVC + Bootstrap 5 | `Views/`, `wwwroot/` |
| Móvil | Expo SDK 57 / React Native 0.86 | `mobile/` |

La base de datos es **Azure SQL** y ya está desplegada en la nube.

---

## Cómo levantar el entorno

```powershell
.\iniciar.ps1        # API + Expo en dos ventanas
.\reiniciar.ps1      # los para y los vuelve a levantar
.\detener.ps1        # los para
```

Para la web y la API: <http://localhost:5199> · Documentación: `/swagger`

Para el móvil, en Expo Go escribe `exp://<TU-IP-DE-RED>:8081` (celular y PC en
la misma WiFi). La URL de la API se cambia en `mobile/src/api/client.ts`
(constante `API_BASE`).

---

## Qué se hizo

### Base y datos (F0)

- **Secretos fuera del repositorio.** `appsettings.json` quedó vacío y todo se
  guarda con *User Secrets* (`dotnet user-secrets`). Se creó
  `appsettings.Production.example.json` como plantilla para desplegar con
  variables de entorno.
- **Librerías vendorizadas** en `wwwroot/lib/`: `Mammoth` (DOCX), `pdf.js`,
  `DOMPurify` y `Alpine.js`. Se quitaron jQuery y el JS duplicado de Bootstrap
  (−3.5 MB).
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
7 pestañas, tema claro/oscuro, sesión con JWT en `expo-secure-store` y autoguardado
con retardo. El APK se genera en la nube con EAS, sin Android Studio.

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

---

## Pendientes

- **Rotar secretos.** La contraseña de Azure SQL y la API key de Anthropic
  estuvieron en el historial de git. Hay que regenerarlas.
- Publicar la API en MonsterASP (`sugoinote.runasp.net`, ya creado): falta
  autorizar la IP del servidor en el firewall de Azure SQL y definir las
  variables de entorno.
- La cuenta de Anthropic sin saldo bloquea las funciones de IA.
- El editor de bloques de la web es texto plano en el móvil: se conserva el
  contenido, no el formato.

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
├─ mobile/            app Expo
│  ├─ src/app/        rutas (Expo Router)
│  ├─ src/screens/    pantallas
│  ├─ src/api/        cliente HTTP con JWT
│  └─ src/theme/      paleta compartida con la web
├─ iniciar.ps1 · reiniciar.ps1 · detener.ps1
└─ Program.cs
```