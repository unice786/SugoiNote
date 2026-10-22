# ─────────────────────────────────────────────────────────────
# Imagen para EJECUTAR LAS PRUEBAS dentro de Docker.
#
# Por qué existe: las pruebas no se ejecutan en el equipo anfitrión
# (aquí Smart App Control bloquea los ensamblados no firmados que
# genera "dotnet test"). Dentro de un contenedor Linux no existe esa
# política, así que las pruebas corren siempre y sin depender de la
# configuración del equipo de cada integrante.
#
# Uso: docker compose run --rm tests
# ─────────────────────────────────────────────────────────────

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS pruebas
WORKDIR /src

# Restore por separado para aprovechar la caché de capas.
COPY SUGOINOTE2/SUGOINOTE2.csproj SUGOINOTE2/
COPY SUGOINOTE2.Tests/SUGOINOTE2.Tests.csproj SUGOINOTE2.Tests/
RUN dotnet restore SUGOINOTE2.Tests/SUGOINOTE2.Tests.csproj

# Código de la API y de las pruebas.
COPY SUGOINOTE2/ SUGOINOTE2/
COPY SUGOINOTE2.Tests/ SUGOINOTE2.Tests/

# mobile/ no forma parte de las pruebas y solo agregaría peso al contexto:
# lo deja fuera el .dockerignore de la raíz.
ENTRYPOINT ["dotnet", "test", "SUGOINOTE2.Tests/SUGOINOTE2.Tests.csproj", \
            "--nologo", "--logger", "console;verbosity=normal", \
            "--collect:XPlat Code Coverage", \
            "--results-directory", "/resultados"]
