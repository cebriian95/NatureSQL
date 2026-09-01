# ADR-0008: Visualización de resultados — tabla + SQL en MVP, gráficos en fase 3

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

Las respuestas incluyen datos tabulares (filas y columnas). Había que decidir cómo se muestran en el chat.

## Decisión

- **MVP:** tabla de resultados + **SQL generado siempre visible** (transparencia educativa) + explicación en lenguaje natural.
- **Fase 3:** gráficos automáticos con **Chart.js** (barras, líneas, tarta) cuando los datos lo permitan; el LLM indicará el tipo de gráfico sugerido en su respuesta estructurada (JSON).
- La respuesta del backend se diseña desde el MVP con campo `chartHint` (opcional/null) para no romper el contrato de la API en la fase 3.

## Alternativas consideradas

- **Gráficos desde el MVP:** más vistoso, pero añade lógica de detección de tipos y casos especiales antes de validar el núcleo.
- **Solo texto (sin tabla):** lo más simple, pero pierde muchísimo valor: los datos reales son la prueba de que el sistema funciona.

## Consecuencias

- (+) MVP enfocado; contrato de API preparado para crecer sin rupturas.
- (+) Los gráficos serán una fase de frontend muy vistosa para el portfolio.
- (−) Hasta la fase 3, preguntas tipo "evolución de ventas" se ven solo como tabla.
