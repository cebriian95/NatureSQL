# ADR-0007: BD propia de la app — SQLite (historial, configuración, claves cifradas)

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

Queremos guardar el historial de conversaciones y las configuraciones (conexiones a BDs de clientes, API keys de LLMs). Eso exige una **base de datos propia de la app**, distinta de las BDs que se conectan los usuarios para consultar.

## Decisión

- **SQLite** como BD propia, accedida con **EF Core 10**.
- Guardará: configuración de conexiones, configuración de proveedores LLM (con API key **cifrada**), historial de conversaciones y mensajes (pregunta, SQL generado, resultado, explicación).
- Cifrado simétrico (AES) de secretos en reposo; la clave maestra vive en *user-secrets* (dev) o variables de entorno (prod), nunca en el repo.
- El archivo `.db` queda fuera del control de versiones (`.gitignore`).

## Alternativas consideradas

- **SQL Server también para la app:** más "empresarial", pero obliga a instalar/levantar un servidor solo para la config; SQLite es un archivo y cero fricción.
- **PostgreSQL para la app:** mismo inconveniente que SQL Server para este caso de uso.
- **Sin persistencia (todo en memoria):** lo más simple, pero se pierde el historial al cerrar; descartado porque el historial aporta mucho valor (y aprendizaje de EF Core).
- **Guardar keys sin cifrar / en `appsettings.json`:** inaceptable por seguridad.

## Consecuencias

- (+) Aprendemos a manejar **dos contextos de datos distintos**: la BD propia (EF Core) y las BDs de clientes (conexión dinámica).
- (+) Cero infraestructura extra para desarrollar.
- (−) SQLite no escala a múltiples instancias de servidor; si la app crece se migraría (EF Core lo hace sencillo).
