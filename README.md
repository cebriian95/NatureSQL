# NatureSQL

Consulta tu base de datos en lenguaje natural. Escribes una pregunta en un chat, una LLM
genera el SQL, se valida, se ejecuta en modo **solo lectura** y ves el resultado junto a una
explicación de lo que se ha buscado.

> Estado: **Fase 0 (cimientos)** completada. Todavía no hay conexiones ni chat;
> el roadmap completo está en [`PROYECTO.md`](PROYECTO.md).

## Requisitos

| Herramienta | Versión | Dónde se fija |
|---|---|---|
| .NET SDK | 10.0.111 | `global.json` |
| Node.js | 24.13.1 | `.nvmrc` |
| Docker + Compose | 29.x / v5.x | — |

## Arrancar con Docker (como lo usará el usuario final)

```bash
docker compose up --build
```

Abre <http://localhost:8080>. El puerto se publica **solo en `127.0.0.1`**: la app no queda
expuesta a la red local.

## Desarrollo

Dos terminales:

```bash
# 1. API en http://localhost:5080
cd src/backend/NatureSql.Api
dotnet run

# 2. Frontend en http://localhost:4200, con recarga en caliente
cd src/frontend
npm start
```

El servidor de desarrollo de Angular redirige `/api` y `/health` al backend
(`src/frontend/proxy.conf.json`), así que el navegador ve un único origen y no hay CORS.

### Tests

```bash
cd src/backend && dotnet test        # xUnit: backend
cd src/frontend && npm test          # Vitest: frontend
```

## Estructura

```
src/backend/     NatureSql.Api · Core · Infrastructure + tests (ver PROYECTO.md §3)
src/frontend/    Angular standalone + signals, Tailwind, Transloco (es/en)
docs/adr/        decisiones de arquitectura
```

## Configuración

Variables de entorno con prefijo `NATURESQL__`:

| Variable | Valores | Por defecto |
|---|---|---|
| `NATURESQL__MODE` | `Local`, `Demo` | `Local` |

## Licencia

[MIT](LICENSE).
