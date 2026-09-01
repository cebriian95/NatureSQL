# Decisiones técnicas (ADRs)

Un **ADR** (*Architecture Decision Record*) es un documento corto que registra **una** decisión técnica importante: qué decidimos, por qué, qué alternativas descartamos y qué consecuencias tiene.

**¿Para qué sirve?** Para que dentro de 6 meses (o cualquier persona/agente que entre al proyecto) entienda *por qué* las cosas son como son, en lugar de tener que adivinarlo o repetir debates ya cerrados.

## Reglas

- Un archivo por decisión: `ADR-XXXX-nombre-corto.md`, numeración correlativa.
- Estado: `Propuesta` → `Aceptada` → (opcionalmente) `Obsoleta` / `Reemplazada por ADR-YYYY`.
- Los ADRs **no se borran**: si una decisión cambia, se crea uno nuevo que la reemplaza.
- Una decisión importante sin ADR es una decisión que se olvidará.

## Plantilla

```markdown
# ADR-XXXX: Título de la decisión

- **Estado:** Propuesta | Aceptada | Obsoleta
- **Fecha:** AAAA-MM-DD

## Contexto
¿Qué problema o necesidad nos obliga a decidir?

## Decisión
¿Qué hemos decidido?

## Alternativas consideradas
¿Qué otras opciones había y por qué se descartaron?

## Consecuencias
¿Qué implica esta decisión, para bien y para mal?
```

## Índice

| ADR | Decisión | Estado |
|---|---|---|
| [0001](ADR-0001-stack-tecnologico.md) | Stack: .NET 10 (LTS) + Angular 21 | Aceptada |
| [0002](ADR-0002-base-de-datos-sql-server.md) | SQL Server como primer motor; dev en Docker + BD demo | Aceptada |
| [0003](ADR-0003-llm-multiproveedor.md) | LLM multi-proveedor con API key del usuario; primero Gemini | Aceptada |
| [0004](ADR-0004-contexto-esquema.md) | Esquema en prompt (MVP) → RAG con embeddings (fase 3) | Aceptada |
| [0005](ADR-0005-solo-lectura.md) | Solo `SELECT` + guardián de SQL | Aceptada |
| [0006](ADR-0006-autenticacion-por-fases.md) | MVP sin login; JWT en fase 2 | Aceptada |
| [0007](ADR-0007-bd-propia-sqlite.md) | BD propia SQLite (historial, config, keys cifradas) | Aceptada |
| [0008](ADR-0008-visualizacion.md) | Tabla + SQL en MVP; gráficos en fase 3 | Aceptada |
| [0009](ADR-0009-modelo-despliegue.md) | App autoalojada (self-hosted) con Docker, junto a la BD | Aceptada |
