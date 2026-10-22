# Entorno de pruebas con Docker

Este documento explica **para que sirve** cada archivo de Docker del proyecto
y como ejecutar las pruebas de SugoiNote sin tocar la base de datos de
produccion ni saturar el equipo.

---

## 1. Para que sirve cada archivo

### `Dockerfile` (en `SUGOINOTE2/`)

Es la **receta de construccion** de la imagen de la API. Define, paso a paso,
como convertir el codigo fuente en algo ejecutable:

1. Toma una imagen con el SDK de .NET 10 y compila el proyecto.
2. Copia el resultado a una imagen mas pequena, que solo tiene el runtime.

El resultado es una **imagen**, que es como un "instalador" congelado de la API.
La ventaja es que la API se ejecuta igual en cualquier equipo, sin necesidad de
instalar .NET, ni SQL Server, ni configurar nada a mano: **lo que funciona en un
equipo funciona en todos**.

Se usa **construccion en dos etapas** (multi-stage) a proposito: la imagen final
no lleva el SDK de compilacion, que pesa mas de 1 GB. Asi la imagen que se
ejecuta queda mucho mas liviana y con menos superficie de ataque.

### `docker-compose.yml` (en la raiz)

Es el **director de orquesta**. Mientras un `Dockerfile` describe *una* imagen,
el compose describe *varios* contenedores y, sobre todo, **como se relacionan
entre si**. Un solo comando levanta todo el conjunto.

Define cuatro servicios:

| Servicio | Que hace |
|---|---|
| `sqlserver` | Un SQL Server 2022 vacio y desechable, solo para pruebas |
| `sqlserver-init` | Crea la base `SugoiNote` y termina |
| `api` | La API de SugoiNote, apuntando al SQL Server del compose |
| `tests` | Ejecuta las 159 pruebas unitarias (bajo demanda) |

### `SUGOINOTE2.Tests/Dockerfile`

Receta de la imagen que **ejecuta las pruebas dentro de un contenedor Linux**.
Existe por una razon concreta de este equipo: Windows tiene activado
**Smart App Control**, una politica de seguridad que bloquea los ensamblados
que genera `dotnet test` por no estar firmados digitalmente. El error que se
produce es:

```
FileLoadException: Una directiva de Control de aplicaciones bloqueo este archivo. (0x800711C7)
```

Dentro de un contenedor Linux esa politica no existe, asi que las pruebas
**siempre se ejecutan**, sin importar como este configurado el equipo de cada
integrante del grupo.

### `.dockerignore`

Lista de archivos que **no** se copian a la imagen. Es tan importante como el
`Dockerfile`: sin el, el build intentaria copiar `mobile/node_modules`, que tiene
cientos de megabytes y ralentizaria cada construccion. Tambien deja fuera las
carpetas `bin` y `obj` de Windows, que no sirven en Linux, y cualquier archivo
con credenciales.

---

## 2. Por que la base de datos va "ahi" dentro

En produccion la API usa la base de datos real, alojada en un servidor externo
(`db72259.public.databaseasp.net`) y con datos de usuarios reales.

En el entorno de pruebas, la API apunta a un **SQL Server que vive dentro de un
contenedor**, completamente separado. Esto permite:

- **Romper cosas sin consecuencias**: se pueden borrar tablas, insertar datos
  incorrectos o probar migraciones sin afectar a ningun usuario.
- **Repetir desde cero**: `docker compose down -v` borra la base por completo y
  la proxima ejecucion la vuelve a crear limpia.
- **No depender de internet**: las pruebas ya no necesitan conectarse al
  servidor de produccion.

La conexion entre ambos contenedores se hace **por nombre de servicio**
(`Server=sqlserver`), no por direccion IP. Docker resuelve ese nombre
automaticamente dentro de su red interna.

---

## 3. Como se ejecuta

Todos los comandos se ejecutan **desde la raiz del repositorio**.

### Levantar la API y la base de datos

```bash
docker compose up --build -d
```

Cuando la API termina de arrancar:

- API: <http://localhost:5265>
- Documentacion Swagger: <http://localhost:5265/swagger>
- Estado de salud: <http://localhost:5265/health>

### Ver los logs

```bash
docker compose logs -f api
```

### Ejecutar las 159 pruebas unitarias

```bash
docker compose run --rm tests
```

### Ejecutar las pruebas con informe de cobertura

```bash
docker compose run --rm -v "$(pwd)/artifacts/cobertura:/resultados" tests
```

El informe queda en `artifacts/cobertura/`, en formato `coverage.cobertura.xml`.

### Apagar

```bash
docker compose down       # apaga, conserva los datos
docker compose down -v    # apaga y BORRA la base de datos
```

---

## 4. Resultados obtenidos

Ejecutado el 22 de octubre de 2026.

| Metrica | Valor |
|---|---|
| Pruebas ejecutadas | 159 |
| Superadas | 159 |
| Fallidas | 0 |
| Tiempo total | 6.8 s |
| Cobertura de lineas | 25.6 % (1234 / 4816) |
| Cobertura de ramas | 25.4 % (361 / 1420) |
| Tablas creadas en el contenedor | 12 |

---

## 5. Detalles tecnicos que conviene conocer

### La API no arranca sin tres variables

`Program.cs` valida su configuracion al iniciar y **detiene la aplicacion** si
falta cualquiera de estas:

| Variable | Para que se usa |
|---|---|
| `ConnectionStrings__DefaultConnection` | Cadena de conexion a la base de datos |
| `IA__ApiKey` | Clave de Google Gemini |
| `Jwt__Key` | Firma de los token JWT (minimo 32 caracteres) |

El compose les asigna **valores de relleno validos en formato**, porque son
obligatorias para que la API arranque aunque las pruebas no usen IA ni envien
correo real. **No sirven para produccion.**

### La redireccion a HTTPS se desactiva dentro del contenedor

La API tiene `UseHttpsRedirection()`, que envia las peticiones de HTTP a HTTPS.
Dentro del contenedor no hay certificado, asi que esa redireccion haria fallar
todas las llamadas. Se desactiva con:

```
App__HttpsRedirection: "false"
```

En produccion (MonsterASP) queda activada por defecto.

### El esquema se crea desde el modelo, no con las migraciones

La migracion `Baseline` del proyecto esta pensada para la base que **ya existia**
en produccion: empieza con `ALTER TABLE` sobre tablas ya creadas, por lo que no
sirve para levantar el esquema desde cero. En el contenedor, la base nace vacia,
asi que se crea el esquema a partir del modelo de EF Core con:

```
App__CrearEsquemaDesdeModelo: "true"
```

### Se corrigio un ciclo de cascada en el modelo

Al crear el esquema en SQL Server aparecia este error:

```
Introducing FOREIGN KEY constraint 'FK_Apuntes_Materias_MateriaID' on table
'Apuntes' may cause cycles or multiple cascade paths.
```

Ocurria porque `Apuntes` llegaba a `Estudiantes` por dos caminos: directo
(`EstudianteID` con `CASCADE`) y a traves de `Materias` (con `CASCADE` +
`SET NULL`). SQL Server rechaza ese grafo.

Se cambio la relacion `Apuntes` -> `Materias` de `SetNull` a `NoAction`.
**No cambia el comportamiento de la aplicacion**: ninguna operacion del sistema
elimina materias, por lo que el `SET NULL` nunca llegaba a ejecutarse.

### Limites de recursos

Cada servicio tiene tope de CPU y memoria (`deploy.resources.limits`), para que
las pruebas **no saturen el equipo** aunque se ejecuten varios contenedores a
la vez:

| Servicio | CPU | Memoria |
|---|---|---|
| `sqlserver` | 2.0 | 2 GB |
| `api` | 2.0 | 1 GB |
| `tests` | 2.0 | 2 GB |

---

## 6. Nota sobre la app movil

La carpeta `mobile/` (la aplicacion Expo) **no participa** en este entorno:

- El proyecto de la API la excluye en `SUGOINOTE2.csproj` (`Compile Remove`).
- El `.dockerignore` la deja fuera de las imagenes.

Asi, la app movil no puede provocar errores en la compilacion ni en la
ejecucion de las pruebas de la API.
