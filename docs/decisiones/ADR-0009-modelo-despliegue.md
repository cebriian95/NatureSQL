# ADR-0009: Modelo de despliegue — app autoalojada (self-hosted) con Docker

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

¿Dónde se ejecuta natureSQL? La app necesita acceso de red a la base de datos del usuario. Dos modelos posibles:

- **SaaS centralizado**: nosotros hosteamos la app en internet y los usuarios conectan sus BDs remotamente.
- **Autoalojada (self-hosted)**: cada usuario/empresa ejecuta la app **en su propia máquina o red**, junto a su BD.

## Decisión

**App autoalojada con Docker.** Cada instancia de natureSQL corre en la misma máquina (o red local) que la base de datos que consulta:

1. El usuario descarga el proyecto (repo o `docker-compose.yml` de distribución).
2. Un comando: `docker compose up -d` → se levantan **backend + frontend (vía reverse proxy) + BD propia (SQLite)** en contenedores.
3. Acceso por navegador: `http://localhost:<puerto>` por defecto; si la red del usuario tiene DNS interno, puede asignarle un nombre (p. ej. `naturesql.local`) — eso es configuración *de su red*, no de la app.
4. El usuario configura su cadena de conexión y su API key del LLM desde la propia web, y empieza a chatear.

Lo único que sale de la máquina del usuario es la llamada a la API del LLM elegido (prompt + esquema + pregunta). Si además usa un LLM local (Ollama), **nada sale de su red**.

> En **desarrollo** (nuestro día a día programando) seguiremos usando `dotnet run` + `ng serve`, más el SQL Server de demo en Docker. El empaquetado Docker "producto" se construye en la fase 4.

## Alternativas consideradas

- **SaaS centralizado (hostear nosotros):** obliga a los usuarios a exponer su SQL Server a internet (inaceptable en seguridad) o a montar VPNs/túneles (fricción enorme). Además nos convertiría en custodios de API keys y cadenas de conexión ajenas (multi-tenant, RGPD...). Descartado.
- **Ejecutable de escritorio (Electron/Tauri):** posible a futuro, pero añade otra tecnología al stack y la web autoalojada cubre el mismo caso.

## Consecuencias

- (+) **Seguridad por diseño**: la BD nunca se expone a internet; cada instancia es independiente.
- (+) Cero costes de servidor/dominio; cada usuario es dueño de su instancia, sus keys y sus datos.
- (+) Caso de uso empresarial realista: una empresa lo despliega en su red interna sin abrir puertos.
- (+) Aprendemos Docker "de producto": Dockerfiles multi-stage, compose con varios servicios, reverse proxy.
- (−) No hay "registro y listo": el usuario debe saber ejecutar `docker compose up -d` (lo documentaremos paso a paso).
- (−) Las actualizaciones las aplica cada usuario (típico del software self-hosted: se mitiga con versionado de imágenes).
