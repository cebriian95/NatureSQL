# NatureSQL — Proyecto

> Documento de referencia del proyecto: visión, arquitectura, features, estructura y fases. Documento vivo: cualquier cambio de decisión se refleja aquí y, si es relevante, en un ADR (`docs/adr/`).
>
> Las normas de trabajo generales están en `CLAUDE.md`.

## Índice

1. Visión · 2. Modos de ejecución · 3. Arquitectura general · 4. Pipeline de una pregunta · 5. Catálogo de esquema · 6. Proveedores de LLM · 7. Modelo de datos · 8. Frontend · 9. Modo Demo · 10. Despliegue · 11. Web comercial · 12. Calidad y tests · 13. Seguridad y privacidad · 14. Decisiones abiertas · 15. Estructura del monorepo · 16. Stack · 17. Roadmap

## 1. Visión

NatureSQL permite consultar una base de datos en lenguaje natural. El usuario escribe una pregunta en un chat ("¿qué clientes gastaron más de 200 € en los últimos 15 días?"), la app genera el SQL con una LLM, lo valida, lo ejecuta en modo solo lectura y muestra el resultado con una explicación de lo que ha hecho.

**Principio rector:** el usuario solo pregunta; la app hace el resto. Nada de configuración obligatoria más allá de conectar la BD y poner una clave de LLM.

### Usuarios objetivo

- **No técnicos** (marketing, encargados): quieren ver datos sin saber SQL. Necesitan respuestas claras y poder verificar qué se ha buscado sin leer código.
- **Desarrolladores**: quieren ir rápido ("muéstrame los datos del procedimiento AU23424") sin escribir consultas ni buscar entre columnas. Valoran ver el SQL y afinar la configuración.

### Qué NO es (v1)

- No es un cliente SQL completo: no se escribe SQL a mano.
- No modifica datos: nunca INSERT/UPDATE/DELETE/DDL.
- No es multiusuario: no hay login ni cuentas.

## 2. Modos de ejecución

La misma imagen Docker funciona en dos modos, controlados por la variable `NATURESQL__MODE`.

| Aspecto | `Local` | `Demo` |
|---|---|---|
| Uso | El usuario la instala en su PC, como DBeaver | Escaparate público en la Raspberry Pi |
| Conexiones | Las que el usuario cree (varias) | Una fija, la BD de la tienda, definida por variables de entorno |
| Crear/editar conexiones | Sí | **Prohibido** (evita que la Pi se use para acceder a la red interna o a terceros) |
| Clave LLM | La del usuario (BYOK) | La del propietario (Gemini), por variables de entorno, nunca visible |
| Persistencia | SQLite en fichero (volumen Docker) | SQLite en memoria, aislado por sesión |
| Sesiones | No aplica | Anónimas, por cookie; se borran tras 30 min de inactividad |
| Rate limit | No | 20 preguntas por sesión + tope diario global |
| Red | Escucha solo en `127.0.0.1` por defecto | Detrás del túnel de Cloudflare |

## 3. Arquitectura general

```
Angular (chat) ──POST + SSE──▶ ASP.NET Core API
                                   │
                    ┌──────────────┼───────────────────────┐
                    ▼              ▼                       ▼
            SQLite (app)    Pipeline de pregunta     Enriquecedor de catálogo
            conexiones,          │                   (segundo plano)
            chats, catálogo      ▼
                          1. Construir contexto
                          2. LLM → JSON (interpretación + SQL)
                          3. Validador (guardarraíles)
                          4. Ejecutor read-only ──▶ BD destino (Postgres)
                          5. [error] 1 reintento con el mensaje de error
                          6. Resultado por SSE
```

### Proyectos del backend

- `NatureSql.Api`: endpoints, SSE, configuración, DI, rate limiting, sirve el Angular compilado.
- `NatureSql.Core`: dominio, interfaces (`IDatabaseProvider`, `ISqlValidator`, `IPromptBuilder`…) y el pipeline. Sin dependencias de infraestructura.
- `NatureSql.Infrastructure`: EF Core + SQLite, proveedores de BD (Postgres), clientes LLM, cifrado.

**Regla de dependencias (arquitectura limpia):** `Api → Core ← Infrastructure`. `Core` no referencia a ningún otro proyecto ni a paquetes de infraestructura (EF Core, Npgsql, SDKs de LLM). `Infrastructure` implementa las interfaces de `Core`, y `Api` las conecta mediante inyección de dependencias. Un test de arquitectura en `UnitTests` comprueba que `Core` no depende de los otros proyectos, para que la regla no se rompa sin darse cuenta.

El diseño sigue los principios SOLID y Clean Code descritos en `CLAUDE.md`.

### Abstracción de motores de BD

```csharp
public interface IDatabaseProvider
{
    DatabaseEngine Engine { get; }
    string DialectName { get; }                 // se inyecta en el prompt
    Task TestConnectionAsync(...);
    Task<SchemaSnapshot> IntrospectAsync(...);  // tablas, columnas, tipos, PK, FK
    Task<SampleValues> SampleAsync(...);        // valores de ejemplo por columna
    ValidationResult Validate(string sql, CatalogView catalog, QueryLimits limits);
    Task<QueryResult> ExecuteAsync(string sql, QueryLimits limits, CancellationToken ct);
}
```

v1 implementa solo **PostgreSQL**. Ningún código específico de Postgres fuera de su implementación. Futuro: SQL Server, MySQL/MariaDB, SQLite.

## 4. Pipeline de una pregunta

### 4.1 Contexto enviado a la LLM

1. Instrucciones de sistema: dialecto, reglas (solo SELECT, usar solo tablas del catálogo, responder en el idioma de la pregunta), formato JSON de salida.
2. Catálogo: tablas y columnas **no ocultas**, con tipos, PK/FK, descripciones y valores de ejemplo (si están permitidos).
3. Historial: últimos 5 turnos del chat (pregunta, interpretación, SQL, columnas devueltas, nº de filas). **Nunca las filas.** Esto permite preguntas de seguimiento ("¿y de esos, cuáles son de Madrid?").
4. Fecha y hora actuales (para "últimos 15 días").

Si el catálogo supera el presupuesto de tokens, en v1 se trunca con prioridad a tablas mencionadas en el historial; la selección por relevancia es fase posterior.

### 4.2 Salida estructurada de la LLM

```json
{
  "type": "query | clarification | not_answerable",
  "interpretation": "Busco clientes cuya suma de pedidos supera 200 € entre el 6 y el 21 de septiembre de 2026.",
  "sql": "SELECT ...",
  "tables": ["clientes", "pedidos"],
  "clarification": null,
  "chart": null
}
```

- `query`: caso normal.
- `clarification`: la pregunta es ambigua de forma que cambiaría el resultado; se devuelve una pregunta al usuario.
- `not_answerable`: la pregunta no tiene que ver con la BD o los datos no existen.
- `chart`: reservado para la fase de gráficas.

Si el proveedor soporta salida estructurada por esquema, se usa. Si no, se extrae el JSON del texto y, si es inválido, se pide **una** reparación.

### 4.3 Guardarraíles (validador)

Defensa en profundidad; cada capa asume que la anterior puede fallar:

1. **Parser SQL real** (nada de regex). Rechaza si:
   - hay más de una sentencia;
   - la sentencia no es `SELECT` o `WITH … SELECT`;
   - referencia tablas fuera del catálogo o tablas/columnas ocultas;
   - usa funciones peligrosas (Postgres: `pg_sleep`, `pg_read_file`, `pg_ls_dir`, `lo_*`, `dblink*`, `set_config`, `pg_terminate_backend`, `COPY`, etc.; lista en código y testeada).
2. **Límite de filas**: se aplica `LIMIT MaxRows + 1` (la fila extra sirve para saber si el resultado está truncado).
3. **Transacción** `BEGIN READ ONLY` + `SET LOCAL statement_timeout` + `ROLLBACK` siempre.
4. **Rol de BD de solo lectura** (recomendado en la documentación; obligatorio en la demo).
5. **Cancelación**: si el usuario cancela o cierra, se cancela la llamada LLM y la consulta.

### 4.4 Reintento

Si la BD devuelve error (columna inexistente, tipo incorrecto…), se reenvía a la LLM el SQL fallido + el mensaje de error **una sola vez**. Un rechazo del validador por seguridad no se reintenta.

### 4.5 Streaming (SSE)

`POST /api/chats/{chatId}/ask` responde `text/event-stream`. El frontend lo consume con `fetch` + `ReadableStream` (no `EventSource`, que solo admite GET) y cancela con `AbortController`.

| Evento | Contenido |
|---|---|
| `stage` | `understanding`, `generating`, `validating`, `executing`, `retrying`, `summarizing` |
| `interpretation` | Texto en lenguaje natural de lo que se va a buscar |
| `sql` | SQL final (plegado en la UI) |
| `clarification` | Pregunta de vuelta al usuario |
| `result` | Columnas, filas, `truncated`, `durationMs` |
| `text` | Fragmentos de texto (resumen en prosa, fase posterior) |
| `error` | Código y mensaje traducible |
| `done` | Tokens usados, id del turno |

## 5. Catálogo de esquema

**Automático por defecto.** El usuario conecta y ya puede preguntar.

1. **Introspección** al crear la conexión: tablas, columnas, tipos, PK, FK, estimación de filas. Se guarda con un hash para detectar cambios ("Reanalizar").
2. **Valores de ejemplo** (activado por defecto, desactivable por conexión):
   - columnas de baja cardinalidad: hasta 10 valores distintos;
   - columnas de texto tipo código: 3 ejemplos;
   - se excluyen automáticamente binarios, textos largos y columnas con nombre sensible (`password`, `hash`, `token`, `secret`, `iban`, `card`, `dni`…).
3. **Descripciones automáticas**: en segundo plano, la LLM genera descripciones por lotes de tablas. La UI muestra el progreso ("Analizando base de datos… 12/40"), pero se puede preguntar desde el primer momento.
4. **Ocultar a la IA** (desactivado por defecto, configurable): tablas o columnas marcadas no aparecen en el prompt y el validador rechaza cualquier consulta que las use.
5. **Edición avanzada** (ajustes, pensada para desarrolladores): corregir descripciones. Las del usuario prevalecen sobre las automáticas y no se sobrescriben al reanalizar.

## 6. Proveedores de LLM (BYOK)

Abstracción: **Microsoft.Extensions.AI** (`IChatClient`).

| Proveedor | Fase | Notas |
|---|---|---|
| Google Gemini | MVP | Proveedor de desarrollo y de la demo |
| Compatible con OpenAI (URL base configurable) | MVP | Cubre OpenAI, OpenRouter, LM Studio, vLLM… |
| Ollama | Fase 2 | Modelos locales; salida estructurada menos fiable |
| Anthropic | Fase 2 | Verificar paquete .NET con soporte `IChatClient` |

- Perfiles de LLM globales (proveedor, modelo, clave, URL base); cada conexión puede elegir uno o usar el predeterminado.
- Las claves se cifran con ASP.NET Data Protection (claves de cifrado persistidas en el volumen) y **nunca** se devuelven al frontend: los campos son de solo escritura.
- Se registra uso de tokens por turno.

## 7. Modelo de datos de la app (SQLite, EF Core + migraciones)

- **Connection**: Id, Name, Engine, Host, Port, Database, Username, EncryptedPassword, SslMode, LlmProfileId?, AllowSampleValues (true), AllowAiSeeResults (false, fase 3), MaxRows (1000), TimeoutSeconds (30), CreatedAt, LastUsedAt.
- **LlmProfile**: Id, Name, Provider, Model, EncryptedApiKey, BaseUrl?, IsDefault.
- **SchemaSnapshot**: Id, ConnectionId, CapturedAt, Hash, EnrichmentStatus.
- **SchemaTable**: Id, SnapshotId, SchemaName, TableName, Description, DescriptionSource (Auto/User), IsHiddenFromAi, RowEstimate.
- **SchemaColumn**: Id, TableId, Name, DataType, IsNullable, IsPrimaryKey, ForeignKeyTable?, ForeignKeyColumn?, Description, DescriptionSource, IsHiddenFromAi, SampleValuesJson.
- **Chat**: Id, ConnectionId, Title (autogenerado, renombrable), CreatedAt, UpdatedAt.
- **Turn**: Id, ChatId, Question, ResponseType, Interpretation, Sql, Status (Ok / Rejected / DbError / LlmError / Cancelled), ErrorCode, ColumnsJson, RowCount, Truncated, DurationMs, Model, InputTokens, OutputTokens, RetryCount, CreatedAt.
- **AppSetting**: Key, Value (idioma, tema…).
- **DemoSession** (solo modo Demo): Id, CreatedAt, LastActivityAt, QuestionCount.

**Las filas de resultados no se guardan.** Al abrir un chat antiguo se ve la pregunta, la interpretación y el SQL, con un botón "Volver a ejecutar". Ventajas: privacidad y una SQLite pequeña.

Chats: varios por conexión, buscador, renombrar y borrar.

## 8. Frontend

- Angular (versión instalada en la máquina), standalone components, signals, **zoneless** (sin `zone.js`), sin NgRx.
- Tailwind CSS v4 + `@lucide/angular` (el antiguo `lucide-angular` está deprecado).
- Diseño con la skill **Impeccable** (`craft` para arrancar, `audit` / `polish` para rematar). `PRODUCT.md` y `DESIGN.md` en la raíz del frontend. Se ejecuta en la Fase 3, cuando ya existen pantallas reales que dar forma.
- **i18n**: Transloco, español e inglés, cambio en caliente. Ningún texto visible hardcodeado desde el primer componente.
- **Tema**: claro, oscuro y "sistema", con selector.

### Pantallas

1. **Principal**: barra lateral (conexiones → chats, buscador), área de chat, entrada de texto con botón cancelar.
2. **Turno de respuesta**: indicador de etapas → interpretación destacada → tabla paginada (aviso si está truncada) → "Ver consulta" plegado con botón copiar.
3. **Ajustes**: conexiones (crear, probar, editar), perfiles LLM, idioma, tema, límites.
4. **Catálogo (avanzado)**: árbol de tablas/columnas, descripciones editables, interruptores "ocultar a la IA" y "valores de ejemplo".
5. **Bienvenida** (primer arranque): asistente de 2 pasos: perfil LLM → primera conexión.

En modo Demo se ocultan las pantallas de conexiones y perfiles, y se muestra un contador de preguntas restantes.

## 9. Modo Demo en detalle

- Sesión anónima con cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- SQLite en memoria (`Mode=Memory;Cache=Shared`): nada se escribe en disco.
- `BackgroundService` cada 5 min borra sesiones con más de 30 min de inactividad (y sus chats).
- Rate limiting de ASP.NET Core: 20 preguntas por sesión y tope diario global configurable (ajustar a los límites vigentes del tier gratuito de Gemini).
- Sin endpoints de conexiones ni de perfiles LLM (no registrados, no solo ocultos en la UI).

### BD de demostración (tienda)

- PostgreSQL con esquema `tienda`: clientes, direcciones, categorías, productos, pedidos, líneas de pedido, pagos, envíos, devoluciones.
- Volumen moderado para la Pi (~2.000 clientes, ~300 productos, ~20.000 pedidos).
- Generación en SQL con semilla fija (`setseed`) y **fechas relativas a `current_date`**.
- Un contenedor auxiliar regenera los datos cada noche para que "últimos 15 días" siempre devuelva resultados.
- Rol `naturesql_ro` con `SELECT` únicamente.

## 10. Despliegue

### Imagen

Dockerfile multi-etapa: compila Angular → compila .NET → imagen final runtime que sirve la API y los estáticos. Se construye en la propia Pi (`docker compose build`), por lo que sale en arm64. **Sin GitHub Actions.**

### Local (usuario final)

`docker-compose.yml` en la raíz: un servicio, puerto `127.0.0.1:8080:8080`, volumen para SQLite y claves de cifrado.

### Raspberry Pi 4 (4 GB, ~500 MB ya ocupados)

`deploy/pi/docker-compose.yml`:

| Servicio | Contenido | Límite RAM |
|---|---|---|
| `naturesql-demo` | App en modo Demo | 384 MB |
| `naturesql-db` | Postgres con la tienda (`shared_buffers` bajo, pocas conexiones), no expuesto | 256 MB |
| `naturesql-seed` | Regeneración nocturna de datos | 64 MB |
| `naturesql-web` | Caddy sirviendo la web comercial + docs | 32 MB |

Expuesto con el túnel de Cloudflare ya existente (p. ej. `naturesql.<dominio>` para la web y `demo.naturesql.<dominio>` para la app).

## 11. Web comercial y documentación

- Bilingüe (es/en).
- Secciones: landing (qué es, para quién, cómo funciona, seguridad/privacidad), enlace a la demo, documentación de instalación (Docker, rol read-only en Postgres, configurar proveedores LLM), FAQ.
- Propuesta: Angular con prerender estático, reutilizando tokens de diseño y Transloco. Confirmar al llegar a esa fase (alternativa: generador de docs dedicado).

## 12. Calidad y tests

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarios backend | xUnit | Validador SQL (casos permitidos y maliciosos), prompt builder, parseo del JSON de la LLM |
| Integración backend | xUnit + Testcontainers (Postgres) | Introspección, muestreo, ejecución read-only, timeouts, pipeline con LLM falsa |
| Unitarios frontend | Vitest | Servicios (cliente SSE, estado del chat), componentes clave |
| E2E | Playwright | Flujo completo con LLM falsa determinista |
| Evaluación de precisión | Proyecto `NatureSql.Evals` | ~30 preguntas sobre la tienda; compara **el conjunto de filas** devuelto con el esperado (no el texto SQL). Se ejecuta a mano: usa LLM real y consume tokens |

## 13. Seguridad y privacidad (resumen)

- Secretos cifrados, nunca devueltos al frontend, nunca en logs.
- Los logs no incluyen filas de resultados.
- Las filas nunca se envían a la LLM salvo permiso explícito por conexión (fase 3), y en ese caso solo una muestra.
- Los valores de ejemplo del catálogo sí se envían por defecto (decisión consciente para precisión; desactivable).
- Modo Demo sin posibilidad de conexiones arbitrarias.
- Modo Local escuchando solo en localhost por defecto.

## 14. Decisiones abiertas

| # | Decisión | Cuándo |
|---|---|---|
| 1 | Librería de parseo SQL para .NET con soporte de dialecto PostgreSQL | Fase 1, ADR-001 |
| 2 | Paquete .NET para Anthropic compatible con `IChatClient` | Fase 6 |
| 3 | Tope diario global de la demo según límites vigentes de Gemini | Fase 5 |
| 4 | Tecnología de la web comercial (propuesta: Angular prerender) | Fase 5 |
| 5 | Umbral de tokens para activar selección de tablas relevantes | Fase 6 |

## 15. Estructura del monorepo

```
naturesql/
├── CLAUDE.md                       # normas de trabajo
├── PROYECTO.md                     # este documento
├── README.md
├── LICENSE
├── global.json                     # versión del SDK de .NET
├── .nvmrc                          # versión de Node
├── docker-compose.yml              # modo Local
├── Dockerfile                      # imagen única: Angular + .NET
├── .dockerignore
├── src/
│   ├── backend/
│   │   ├── NatureSql.slnx          # formato de solución XML del SDK de .NET 10
│   │   ├── Directory.Build.props   # TargetFramework y nullable comunes
│   │   ├── NatureSql.Api/
│   │   ├── NatureSql.Core/
│   │   ├── NatureSql.Infrastructure/
│   │   └── tests/
│   │       ├── NatureSql.UnitTests/
│   │       ├── NatureSql.IntegrationTests/
│   │       └── NatureSql.Evals/
│   └── frontend/                   # Angular (+ PRODUCT.md, DESIGN.md de Impeccable)
├── demo-db/                        # generador SQL de la tienda + rol read-only
├── website/                        # web comercial + docs (es/en)
├── deploy/pi/docker-compose.yml    # demo en Raspberry Pi
└── docs/
    └── adr/                        # registro de decisiones de arquitectura
```

## 16. Stack

- **Backend**: ASP.NET Core, EF Core + SQLite (datos de la app), Npgsql (BD destino), Microsoft.Extensions.AI (`IChatClient`), SSE para streaming.
- **Frontend**: Angular standalone + signals + zoneless, Tailwind CSS v4, `@lucide/angular`, Transloco, skill Impeccable para diseño.
- **Tests**: xUnit, Testcontainers, Vitest, Playwright.
- **Despliegue**: Docker; imagen construida en la Raspberry Pi (arm64). Sin CI/CD.
- **Versiones instaladas y fijadas** (Fase 0): .NET SDK **10.0.111** (`global.json`), Node **24.13.1** (`.nvmrc`), Angular CLI **21.1.4**, Docker **29.8.1** / Compose **v5.5.1**.

### Puertos

| Entorno | Qué | Puerto |
|---|---|---|
| Desarrollo | API (`dotnet run`) | 5080 |
| Desarrollo | Angular (`npm start`, con proxy a 5080) | 4200 |
| Docker | Imagen única, publicada solo en `127.0.0.1` | 8080 |

## 17. Roadmap

Cada fase termina con algo que funciona y se puede probar. Marca las casillas conforme avancen.

### Fase 0 · Cimientos

- [x] Detectar versiones instaladas (`dotnet --list-sdks`, `ng version`, `node -v`, `docker --version`) y fijarlas en `global.json`, `.nvmrc` y el README.
- [x] Estructura del monorepo (ver sección 15).
- [x] Solución .NET: `Api`, `Core`, `Infrastructure`, `UnitTests`, `IntegrationTests`.
- [x] Angular: standalone, Tailwind, `@lucide/angular`, Transloco (es/en), tema claro/oscuro/sistema.
- [x] Test de arquitectura: `Core` no depende de `Api` ni de `Infrastructure`.
- [x] Endpoint `/health`.
- [x] Dockerfile multi-etapa (una sola imagen) + `docker-compose.yml` local en `127.0.0.1`.
- [x] `.gitignore`, `LICENSE` (MIT), README inicial.

**Hito:** `docker compose up` sirve el Angular vacío desde .NET. ✅

Decisiones tomadas durante la fase:
- El SDK de .NET 10 genera la solución en formato `.slnx` (XML, sin GUIDs); se mantiene.
- El test de arquitectura se escribe con reflexión sobre el ensamblado, sin añadir dependencias.
- Impeccable (`craft`) se traslada a la Fase 3: necesita pantallas reales para ser útil.
- La CLI de Angular 21 ya configura Tailwind v4 y Vitest, así que no hacen falta pasos extra.

### Fase 1 · Conexiones y ejecución segura

- [ ] SQLite con EF Core + migraciones: `Connection`, `LlmProfile`, `AppSetting`.
- [ ] Cifrado de secretos con Data Protection (claves en volumen).
- [ ] CRUD de conexiones + "Probar conexión" (secretos solo escritura).
- [ ] `PostgresDatabaseProvider`: introspección de esquema.
- [ ] ADR-001: elegir parser SQL.
- [ ] Validador + **tests unitarios exhaustivos** (casos válidos, maliciosos, trucos: comentarios, múltiples sentencias, CTEs con escritura, funciones peligrosas).
- [ ] Ejecutor: `READ ONLY`, `statement_timeout`, `LIMIT MaxRows+1`, cancelación.
- [ ] Tests de integración con Testcontainers.

**Hito:** un endpoint de prueba ejecuta SQL escrito a mano de forma segura contra Postgres.

### Fase 2 · LLM y pipeline

- [ ] Perfiles LLM + cliente Gemini y compatible OpenAI vía `IChatClient`.
- [ ] Prompt builder (catálogo, historial, fecha, idioma).
- [ ] Parseo robusto del JSON + una reparación.
- [ ] Pipeline completo con reintento único en error de BD.
- [ ] `Chat` y `Turn` persistidos; memoria de los últimos 5 turnos.
- [ ] Endpoint SSE con eventos de etapa y cancelación.
- [ ] LLM falsa para tests; tests de integración del pipeline.

**Hito:** una pregunta vía `curl` devuelve eventos SSE con interpretación, SQL y filas.

### Fase 3 · Frontend MVP

- [ ] Layout: barra lateral (conexiones → chats), chat, entrada con cancelar.
- [ ] Cliente SSE (`fetch` + `ReadableStream` + `AbortController`).
- [ ] Turno: etapas → interpretación → tabla paginada → "Ver consulta".
- [ ] Chats: crear, renombrar, borrar, buscar, "Volver a ejecutar".
- [ ] Ajustes: conexiones, perfiles LLM, idioma, tema, límites.
- [ ] Asistente de bienvenida.
- [ ] Tests Vitest de servicios clave.
- [ ] Impeccable: `craft` para fijar la dirección visual y `PRODUCT.md` / `DESIGN.md`, y luego `audit` + `polish` para rematar.

**Hito: MVP usable en tu PC contra tu propia BD.**

### Fase 4 · Catálogo automático

- [ ] Muestreo de valores con exclusión de columnas sensibles.
- [ ] Enriquecimiento de descripciones en segundo plano con progreso en la UI.
- [ ] Ocultar tablas/columnas a la IA (prompt + validador).
- [ ] Pantalla avanzada de catálogo; descripciones de usuario prevalecen.
- [ ] "Reanalizar" con detección de cambios por hash.

### Fase 5 · Demo y web (v1.0)

- [ ] Generador SQL de la tienda (semilla fija, fechas relativas) + rol `naturesql_ro`.
- [ ] Contenedor de regeneración nocturna.
- [ ] Modo Demo: sesiones en memoria, cookie, purga por inactividad, rate limiting, endpoints de configuración no registrados.
- [ ] `deploy/pi/docker-compose.yml` con límites de memoria.
- [ ] Web comercial + docs bilingüe.
- [ ] E2E con Playwright.
- [ ] Suite de evaluación sobre la tienda (~30 preguntas) y primer informe de precisión.

**Hito: v1.0 pública en la Pi.**

### Fase 6+ · Evolución

- [ ] Gráficas sugeridas por la LLM (sin ver datos) + exportar CSV/Excel.
- [ ] Permiso "la IA puede ver resultados": resúmenes en prosa sobre una muestra.
- [ ] Proveedores Ollama y Anthropic.
- [ ] Motores SQL Server, MySQL/MariaDB, SQLite.
- [ ] Selección de tablas relevantes para esquemas grandes.
- [ ] Modo agente con herramientas (búsqueda de valores → caso "procedimiento AU23424").
- [ ] Coste de tokens acumulado por conexión.
