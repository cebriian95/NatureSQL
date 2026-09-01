# ADR-0004: Contexto del esquema — prompt directo primero, RAG en fase 3

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

Para generar SQL correcto, el LLM necesita conocer el esquema de la BD (tablas, columnas, tipos, relaciones). ¿Cómo se lo damos?

## Decisión

Por fases:

1. **MVP (fases 1-2):** el esquema completo se inserta en el **prompt** (texto DDL simplificado: `CREATE TABLE ...` o lista `tabla(columna tipo, ...)` + claves foráneas).
2. **Fase 3:** **RAG con embeddings** sobre las descripciones de tablas/columnas: para cada pregunta se recuperan solo las tablas relevantes. Necesario cuando el esquema no cabe en la ventana de contexto.

## Alternativas consideradas

- **RAG desde el inicio:** escala mejor, pero añade de golpe embeddings, almacén vectorial y pipeline de indexación: demasiada complejidad antes de tener un MVP funcionando.
- **Solo prompt siempre:** suficiente para esquemas pequeños/medianos, pero se degrada con cientos de tablas; queremos que la app escale.
- **Fine-tuning de un modelo:** caro, lento y totalmente innecesario para Text-to-SQL con buen prompting.

## Consecuencias

- (+) MVP simple y comprensible de principio a fin.
- (+) Cuando llegue la fase 3 entenderemos *por qué* existe RAG (habremos sentido el límite del prompt).
- (−) Con BDs muy grandes el MVP puede quedarse sin contexto o degradar la calidad; limitación conocida y documentada.
