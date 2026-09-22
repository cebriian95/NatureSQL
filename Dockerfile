# Imagen única: el Angular compilado se sirve como estáticos desde la propia API .NET.
# Tres etapas para que la imagen final solo contenga el runtime, sin Node ni el SDK de .NET.

# ---------- 1. Frontend ----------
FROM node:24-alpine AS frontend
WORKDIR /build

# package.json y package-lock.json se copian primero y solos: mientras no cambien,
# Docker reutiliza la capa de `npm ci` en vez de reinstalar en cada build.
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci

COPY src/frontend/ ./
RUN npm run build

# ---------- 2. Backend ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /build

COPY src/backend/ ./
RUN dotnet restore NatureSql.slnx

# El frontend compilado entra como wwwroot, que es la carpeta de estáticos de ASP.NET Core.
COPY --from=frontend /build/dist/naturesql/browser ./NatureSql.Api/wwwroot

RUN dotnet publish NatureSql.Api/NatureSql.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /publish

# ---------- 3. Runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=backend /publish ./

# Carpeta para la SQLite de la app y las claves de cifrado (se monta como volumen).
# Se crea aquí y con el dueño correcto porque el proceso no corre como root.
RUN mkdir -p /app/data && chown -R $APP_UID:0 /app/data

ENV ASPNETCORE_HTTP_PORTS=8080 \
    NATURESQL__MODE=Local

EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["dotnet", "NatureSql.Api.dll"]
