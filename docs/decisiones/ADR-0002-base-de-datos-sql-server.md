# ADR-0002: Base de datos objetivo — SQL Server (dev en Docker + BD demo)

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

La app se conecta a bases de datos *del usuario*. Hay que elegir el primer motor a soportar y cómo montar el entorno de desarrollo/pruebas.

## Decisión

- Primer motor soportado: **SQL Server 2022**.
- Desarrollo: contenedor **Docker** con la imagen oficial de Microsoft (`mcr.microsoft.com/mssql/server`), orquestado con `docker-compose.yml` en `docker/`.
- Datos de prueba: BD de demo **"tienda"** (Customers, Products, Orders, OrderItems) con scripts en `docker/demo-db/`.
- La capa de acceso a datos del cliente se diseña tras una **abstracción** para poder añadir PostgreSQL/MySQL en el futuro sin reescribir el núcleo.

## Alternativas consideradas

- **PostgreSQL primero:** excelente opción open source; descartada porque SQL Server es lo dominante en ofertas .NET del entorno del usuario.
- **SQLite como BD objetivo:** ideal para prototipos, pero poco realista como "BD de empresa".
- **SQL Server instalado en local:** el usuario está en Linux; Docker evita instalaciones pesadas y es reproducible.

## Consecuencias

- (+) Entorno de desarrollo reproducible con un comando (`docker compose up -d`).
- (+) Aprendemos Docker y administración básica de SQL Server.
- (−) SQL Server en Docker exige ~2 GB de RAM para el contenedor.
- (−) Añadir motores nuevos exigirá disciplina para mantener la abstracción limpia.
