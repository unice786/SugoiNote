# ─────────────────────────────────────────────────────────────
# Imagen de la API de SugoiNote para ejecutar las PRUEBAS en local.
# Multi-stage: se compila con el SDK y se ejecuta con el runtime
# (la imagen final no lleva el SDK, pesa mucho menos).
#
# Uso: se levanta con docker compose (ver docker-compose.yml).
# ─────────────────────────────────────────────────────────────

# ── Etapa 1: compilación ─────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Primero solo el csproj: si no cambia, Docker reutiliza la capa de restore
# y no vuelve a descargar los paquetes en cada compilación.
COPY SUGOINOTE2/SUGOINOTE2.csproj SUGOINOTE2/
RUN dotnet restore SUGOINOTE2/SUGOINOTE2.csproj

# Ahora el código. El .dockerignore deja fuera mobile/node_modules, bin y obj.
COPY . .
WORKDIR /src/SUGOINOTE2

# AspNetCoreHostingModel=InProcess está pensado para IIS/MonsterASP y no
# aplica en Linux: se neutraliza solo para esta compilación.
RUN dotnet publish SUGOINOTE2.csproj \
      -c Release \
      -o /app/publish \
      -p:AspNetCoreHostingModel= \
      -p:UseAppHost=false

# ── Etapa 2: ejecución ───────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl sirve para el healthcheck del compose (la imagen base no lo trae).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# La API escucha en 8080 dentro del contenedor.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# El healthcheck consulta /health (lo publica Program.cs con MapHealthChecks).
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=6 \
  CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "SUGOINOTE2.dll"]
