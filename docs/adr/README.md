# Registro de decisiones de arquitectura (ADR)

Un ADR documenta **una** decisión que condiciona el resto del proyecto y que sería costoso
revertir: qué se decidió, por qué, y qué se descartó. No se editan al cambiar de opinión;
se escribe un ADR nuevo que sustituya al anterior.

Nombre de fichero: `NNN-titulo-en-kebab-case.md`, numerado correlativamente.

## Plantilla

```markdown
# NNN · Título de la decisión

- **Fecha:** AAAA-MM-DD
- **Estado:** propuesta | aceptada | sustituida por ADR-NNN

## Contexto

Qué problema hay que resolver y qué restricciones existen.

## Decisión

Qué se hace, en una o dos frases.

## Alternativas consideradas

Cada una con por qué se descartó.

## Consecuencias

Lo bueno y lo malo que asumimos, incluyendo lo que queda más difícil a partir de ahora.
```

## Índice

| ADR | Decisión | Estado |
|---|---|---|
| _(pendiente)_ | ADR-001: librería de parseo SQL para PostgreSQL | Fase 1 |
