# SugoiNote — App móvil

Aplicación móvil de SugoiNote hecha con **Expo (SDK 57)** y **React Native 0.86**.
Es la tercera capa del proyecto integrador: la API es ASP.NET Core y el cliente
web es el mismo proyecto MVC.

## Requisitos

- Node.js 22.13 o superior (probado con 26.7)
- Una cuenta de Expo (gratis) para construir la APK

## Puesta en marcha

Los scripts de la carpeta del proyecto (una arriba) levantan todo:

```powershell
.\iniciar.ps1      # abre la API y Metro en dos ventanas separadas
.\reiniciar.ps1    # los para y los vuelve a levantar
.\detener.ps1      # los para
```

`iniciar.ps1` detecta tu IP de red y avisa si `API_BASE` en `src/api/client.ts`
ya no coincide, que es el error mas comun cuando el wifi te cambia la IP.

Manualmente:

```bash
cd mobile
npm install
npx expo start
```

Se abre un QR en la terminal. Escanéalo con la app Expo Go desde el celular.

> **Importante con Expo Go en iOS y SDK 57:** hace falta iniciar sesion con la
> MISMA cuenta en los dos lados. En la terminal: `npx expo login`. En el
> telefono: Expo Go, pestana Home, icono de avatar arriba a la derecha.
> Sin eso la app se queda en un engranaje o pantalla blanca aunque el bundle se
> descargue bien. Los development builds y las APK de EAS no lo requieren.

> **Ojo:** si agregás una librería con código nativo, Expo Go ya no alcanza y
> hace falta un development build (`npx expo run:android` o
> `npx eas-cli@latest build --profile development`).

## Configurar la dirección de la API

Está en **`src/api/client.ts`**, constante `API_BASE`:

```ts
export const API_BASE = 'http://192.168.1.68:5199';
```

- **En tu celular:** `localhost` apunta al teléfono, no a tu PC. Pon la IP local
  de tu computadora, en la misma red WiFi. Para descubrirla:
  ```bash
  ipconfig
  ```
- **Con la API publicada:** cámbiala por `https://sugoinote.runasp.net`.

### La API debe escuchar en la red (importante)

Si la levantás con `dotnet run` normal, escucha **solo en `localhost`** y el
celular no la encuentra. Usá el perfil `celular`:

```powershell
cd ..\..
dotnet run --launch-profile celular
```

Ese perfil arranca en `http://0.0.0.0:5199`, que sí es accesible desde la red.

### Conectar Expo Go sin QR

Si el QR apunta a `localhost`, el celular busca el servidor en sí mismo y se
queda cargando. Escribe la dirección a mano en Expo Go:

```
exp://192.168.1.68:8081
```

El **primer arranque tarda 1 o 2 minutos**: el bundle de desarrollo pesa unos
6 MB y se construye en el momento.

## Generar la APK (sin Android Studio)

Gracias a EAS el APK se compila **en la nube**:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Cuando termine, EAS da un enlace de descarga directo a la `.apk`. Se instala en
cualquier teléfono Android, sin necesidad de tener el proyecto en la máquina.

Los perfiles de build se configuran en `eas.json` (aún no creado; por defecto EAS
crea `preview` automáticamente la primera vez).

## Estructura

```
mobile/
├─ src/
│  ├─ app/                  rutas (Expo Router, basado en archivos)
│  │  ├─ _layout.tsx        proveedores + control de sesión
│  │  ├─ login.tsx
│  │  ├─ editor.tsx  resumen.tsx  examen.tsx  post.tsx
│  │  └─ (pestanas)/        las 7 pestañas del menú
│  ├─ screens/              pantallas (lógica de UI)
│  ├─ components/           componentes compartidos
│  ├─ context/              sesión (JWT) y tema
│  ├─ api/client.ts         cliente HTTP con JWT
│  ├─ theme/tokens.ts       paleta (puerto de _tokens.css del web)
│  └─ utils/html.ts         conversión HTML <-> texto plano
```

### Decisiones que conviene conocer

- **Expo Router**, no React Navigation: desde el SDK 56 Expo Router ya no admite
  importar `@react-navigation/*` en el código de la aplicación.
- **JWT en `expo-secure-store`**, no cookies: React Native no comparte el almacén
  de cookies del navegador, así que la API expone `/api/auth/login` que devuelve
  un token.
- **Iconos con emoji** a propósito: una fuente de iconos añade dependencias
  nativas y peso a la APK sin aportar nada aquí.
- **Editor en texto plano**: la web usa un editor de bloques que guarda HTML. En
  móvil no hay equivalente, así que se edita en texto y se convierte a `<p>` al
  guardar. Se conserva el contenido, no el formato.
- **Los resúmenes se piden por `apunteId`**, no pasando el HTML por la ruta.

## Autenticación

| Acción | Endpoint |
|---|---|
| Registro | `POST /api/auth/registrar` |
| Login | `POST /api/auth/login` |
| Sesión | `GET /api/auth/me` |

Cada petición va con `Authorization: Bearer <token>`.

## Endpoints que consume la app

| Area | Endpoints |
|---|---|
| Apuntes | `GET /api/apuntes` - `POST /api/apuntes` - `GET /api/apuntes/{id}` - `POST /api/apuntes/{id}/autosave` - `DELETE /api/apuntes/{id}` |
| Resúmenes | `GET /api/resumenes` - `GET /api/resumenes/{apunteId}` - `GET /api/resumenes/apuntes` - `POST /api/resumenes/generar` |
| Exámenes | `GET /api/examenes` - `POST /api/examenes/generar` - `GET /api/examenes/{id}` - `POST /api/examenes/{id}/calificar` |
| Chat | `POST /api/chat/enviar` |
| Comunidad | `GET /api/comunidad` - `GET /api/comunidad/{id}` - `POST /api/comunidad/posts` - `POST /api/comunidad/encuestas` - `POST /api/comunidad/{id}/responder` - `POST /api/comunidad/{id}/votar` |
| Perfil | `GET /api/perfil` - `PUT /api/perfil` - `PUT /api/perfil/foto` |

Los expone `Controllers/Api/` en el proyecto de .NET. Todos reutilizan los mismos
servicios que el cliente web, asi que el filtro por propietario ya viene aplicado.

Nota de seguridad: `GET /api/examenes/{id}` NO envia `esLaCorrecta` mientras el
examen no este calificado. Si lo enviara siempre, bastaria leer el JSON y marcar
siempre la opcion correcta para aprobar sin saber la materia.

## Comandos de verificación

```bash
npx tsc --noEmit      # tipos
npx expo lint         # ESLint (reglas de react-hooks incluidas)
npx expo-doctor       # 21 chequeos de configuración y dependencias
npx expo export --platform android   # genera el bundle
```