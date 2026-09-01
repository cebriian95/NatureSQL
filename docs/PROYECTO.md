# natureSQL — Documentación del proyecto

> **"Habla con tu base de datos"**: de "escribir SQL" a "preguntar en lenguaje natural".

---

## 1. Visión

natureSQL es una aplicación web que permite a cualquier persona **consultar una base de datos SQL haciendo preguntas en lenguaje natural**, sin saber SQL.

El usuario conecta su base de datos, configura su propia API key de un modelo de IA y chatea:

> — *"¿Cuántos clientes gastaron más de 300 € el último mes?"*
> — *"El último mes, **17 clientes** superaron los 300 €. Aquí tienes el detalle:"* [tabla con datos reales]

La respuesta se construye con **datos reales** de la base de datos, no con texto inventado por la IA.

## 2. ¿Cómo funciona? (Text-to-SQL vs RAG)

natureSQL es, técnicamente, un sistema **Text-to-SQL**:

```
Pregunta en lenguaje natural
        │
        ▼
  LLM recibe la pregunta + el ESQUEMA de la BD (tablas, columnas, relaciones)
        │
        ▼
  El LLM genera una consulta SQL  ← el LLM NO inventa datos, solo escribe la consulta
        │
        ▼
  Guardián de SQL (validación de seguridad propia)
        │
        ▼
  Ejecutamos el SQL contra la BD real (solo lectura)
        │
        ▼
  Respuesta: tabla de resultados + SQL visible + explicación en lenguaje natural
```

**¿Y el RAG?** RAG (*Retrieval-Augmented Generation*) consiste en recuperar solo la información relevante (usando *embeddings*) antes de preguntar al LLM. En nuestro caso se usará cuando la BD tenga **demasiadas tablas** para meter todo el esquema en el prompt: recuperaremos solo las tablas relevantes para cada pregunta. Es la **fase 3** del roadmap (ver ADR-0004).

## 3. Alcance y roadmap

| Fase | Contenido | Estado |
|---|---|---|
| **0. Cimientos** | Documentación, scaffolding, SQL Server en Docker, BD demo "tienda" | ⏳ En curso |
| **1. MVP** | Configurar conexión BD, introspección de esquema, configurar LLM (Gemini), chat Text-to-SQL, guardián SQL, tabla + SQL visible, historial en SQLite | 🔲 |
| **2. Confianza** | Auto-corrección de SQL fallido, proveedores OpenAI/Claude/Ollama, autenticación JWT | 🔲 |
| **3. Escala** | RAG con embeddings para esquemas grandes, gráficos (Chart.js), exportar CSV | 🔲 |
| **4. Producto** | Empaquetado Docker "self-hosted" (compose de distribución, reverse proxy, guía de instalación) | 🔲 |
| **5. Futuro** | Escritura confirmada por humano, más motores de BD (PostgreSQL, MySQL) | 🔲 |

## 4. Arquitectura

### 4.1 Vista general

```
┌──────────────┐                ┌────────────────────────────────────┐
│   Angular     │    HTTPS      │         ASP.NET Core Web API       │
│  (frontend)   │ ◄────────────►│                                    │
│  Chat UI      │               │  Api → Application → Domain        │
└──────────────┘                │              ↑ (implementa)        │
                                │        Infrastructure              │
                                │         ├─ LLM Providers ──────────┼──► API del LLM (Gemini, OpenAI...)
                                │         ├─ SQL Guardian            │
                                │         ├─ SQL Client ─────────────┼──► SQL Server del cliente (Docker)
                                │         └─ EF Core ────────────────┼──► SQLite propio (historial, config, keys cifradas)
                                └────────────────────────────────────┘
```

> Diagrama lógico. En **desarrollo**: frontend con `ng serve` y backend con `dotnet run`.
> En **producto**: ambos servidos juntos dentro del compose (ver 4.2 y ADR-0009).

### 4.2 Modelo de despliegue: autoalojado (self-hosted)

natureSQL **no es un SaaS**: cada usuario/empresa ejecuta su propia instancia **en la misma máquina o red local que su base de datos** (ver ADR-0009):

```
┌─────────────────────────── Máquina/red del usuario ───────────────────────────┐
│                                                                               │
│   Navegador ──► http://localhost:8080 (o nombre DNS interno, p.ej.            │
│                 naturesql.local, configurado por el usuario en su red)        │
│                      │                                                        │
│                      ▼                                                        │
│   ┌─────────────────────────────────────┐      ┌─────────────────────────┐    │
│   │  natureSQL (docker compose)         │      │  SQL Server del usuario │    │
│   │  ├─ reverse proxy + frontend        │ ───► │  (misma máquina o red)  │    │
│   │  ├─ backend API                     │      └─────────────────────────┘    │
│   │  └─ SQLite propio (volumen Docker)  │                                     │
│   └─────────────────┬───────────────────┘                                     │
└─────────────────────┼─────────────────────────────────────────────────────────┘
                      ▼  (única salida a internet, y opcional)
              API del LLM elegido (Gemini, OpenAI, Claude)
              — si el LLM es local (Ollama), nada sale de la red —
```

- Instalación: clonar el repo (o descargar el compose de distribución) y `docker compose up -d`.
- Desarrollo (nuestro día a día): `dotnet run` + `ng serve` + SQL Server de demo en Docker.
- Empaquetado "producto" (Dockerfiles, compose de distribución, guía de instalación): **fase 4**.

### 4.3 Backend — Clean Architecture (4 capas)

| Capa | Responsabilidad | Depende de |
|---|---|---|
| `NatureSQL.Domain` | Entidades, interfaces (`ILLMProvider`, `ISqlGuardian`...). **Sin dependencias externas.** | Nada |
| `NatureSQL.Application` | Casos de uso: "procesar pregunta del chat", "probar conexión"... | Domain |
| `NatureSQL.Infrastructure` | Implementaciones: EF Core, proveedores LLM, guardián SQL, cifrado | Domain, Application |
| `NatureSQL.Api` | Controllers, middleware de errores, configuración HTTP | Application, Infrastructure |

**Regla de oro:** las dependencias apuntan hacia dentro. `Domain` no sabe que existe HTTP ni bases de datos.

### 4.4 Flujo completo de una pregunta

1. El usuario escribe una pregunta en el chat (Angular).
2. `POST /api/chat` → backend.
3. El backend carga la configuración activa (conexión a BD + proveedor LLM), **descifrando las claves solo en memoria**.
4. `PromptBuilder` construye el prompt: *system prompt* + esquema de la BD + pregunta.
5. El `ILLMProvider` activo envía el prompt y recibe **SQL candidato**.
6. El **guardián de SQL** lo valida: solo `SELECT`, una única sentencia, sin palabras peligrosas, límite de filas forzado (`TOP n`).
7. Se ejecuta contra la BD del cliente con **timeout** y límite de filas.
8. Si falla (fase 2): el error se devuelve al LLM para auto-corregir (máx. N reintentos).
9. Respuesta al frontend: `{ sql, columns, rows, explanation, chartHint: null }` → se muestra **tabla + SQL + explicación**. (`chartHint` nace en `null`, reservado para los gráficos de la fase 3 — ver ADR-0008).

## 5. Decisiones técnicas

Resumen (detalle y alternativas en cada ADR):

| ADR | Decisión |
|---|---|
| [0001](decisiones/ADR-0001-stack-tecnologico.md) | .NET 10 (LTS) + Angular 21 |
| [0002](decisiones/ADR-0002-base-de-datos-sql-server.md) | SQL Server como primer motor; dev en Docker + BD demo |
| [0003](decisiones/ADR-0003-llm-multiproveedor.md) | Multi-proveedor LLM; la API key la pone el usuario; empezamos con Gemini |
| [0004](decisiones/ADR-0004-contexto-esquema.md) | Esquema en prompt primero; RAG con embeddings en fase 3 |
| [0005](decisiones/ADR-0005-solo-lectura.md) | Solo `SELECT` + guardián de SQL |
| [0006](decisiones/ADR-0006-autenticacion-por-fases.md) | MVP sin login; JWT en fase 2 |
| [0007](decisiones/ADR-0007-bd-propia-sqlite.md) | BD propia SQLite para historial/config; claves cifradas |
| [0008](decisiones/ADR-0008-visualizacion.md) | Tabla + SQL en MVP; gráficos en fase 3 |
| [0009](decisiones/ADR-0009-modelo-despliegue.md) | App autoalojada (self-hosted) con Docker, junto a la BD |

## 6. Seguridad

- **API keys del LLM y cadenas de conexión**: cifradas en reposo (AES) en la BD propia; la clave de cifrado vive en *user-secrets*/variables de entorno, nunca en el repo. Nunca se devuelven al frontend ni se escriben en logs.
- **Guardián de SQL**: validación propia de toda consulta generada (ver ADR-0005). El LLM propone, la app dispone.
- **Privilegios mínimos**: se recomienda conectar la BD del cliente con un usuario de **solo lectura**.
- **Límites**: `TOP n` forzado, timeout de consulta, máximo de filas devueltas.
- **Rate limiting** en los endpoints que llaman al LLM (proteger la API key del usuario y su factura).
- **CORS** restringido al frontend.
- **HTTPS** en producción.
- **Despliegue junto a los datos**: la app se autoaloja en la red del usuario (ADR-0009); la BD nunca se expone a internet.

## 7. La base de datos de demo ("tienda")

Para desarrollar y probar usaremos una BD de ejemplo en el SQL Server de Docker:

- `Customers` (clientes)
- `Products` (productos, con categoría y precio)
- `Orders` (pedidos, con fecha)
- `OrderItems` (líneas de pedido: cantidad y precio)

Con datos de prueba suficientes para preguntas tipo: *"top 5 productos más vendidos"*, *"clientes que más gastaron en marzo"*, *"ventas por categoría"*...

## 8. Glosario

| Término | Significado |
|---|---|
| **LLM** | *Large Language Model*: modelo de IA que genera texto (Gemini, GPT, Claude...). |
| **Prompt** | El texto de instrucciones que enviamos al LLM. |
| **System prompt** | Instrucciones fijas que definen el comportamiento del LLM ("eres un generador de SQL, solo respondes con SELECT..."). |
| **Token** | Unidad de texto que procesa el LLM (~4 caracteres). Los prompts y respuestas se miden/facturan en tokens. |
| **Text-to-SQL** | Técnica: el LLM traduce lenguaje natural a SQL usando el esquema de la BD como contexto. |
| **RAG** | *Retrieval-Augmented Generation*: recuperar información relevante (con embeddings) y añadirla al prompt. |
| **Embedding** | Vector numérico que representa el significado de un texto; permite búsquedas por similitud semántica. |
| **Guardián de SQL** | Componente propio que valida y limita el SQL generado antes de ejecutarlo. |
| **Introspección de esquema** | Leer la estructura de la BD (tablas, columnas, tipos, claves) mediante consultas al sistema. |
| **ADR** | *Architecture Decision Record*: documento que registra una decisión técnica y sus alternativas (ver `docs/decisiones/`). |
| **Clean Architecture** | Organización en capas donde el dominio no depende de detalles técnicos (BD, HTTP...). |
| **DTO** | *Data Transfer Object*: objeto solo para transportar datos entre capas/API, sin lógica. |
| **Inyección de dependencias** | Patrón: las clases reciben sus dependencias (interfaces) por el constructor; facilita tests y desacoplamiento. |
| **Self-hosted (autoalojado)** | Software que cada usuario instala y ejecuta en su propia infraestructura, en lugar de consumirlo como servicio en la nube del proveedor. |
| **SaaS** | *Software as a Service*: app centralizada hosteada por el proveedor a la que los usuarios acceden por internet (modelo descartado para natureSQL). |
| **Reverse proxy** | Servidor (Nginx, Caddy...) que recibe las peticiones del navegador y las reparte: estáticos al frontend, `/api` al backend. |
| **DNS local / interno** | Nombre de red propio (p. ej. `naturesql.local`) que el usuario configura en su red para acceder a la app con nombre en vez de `localhost:puerto`. |
