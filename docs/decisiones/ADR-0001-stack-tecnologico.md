# ADR-0001: Stack tecnológico — .NET 10 + Angular 21

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

Es un proyecto de aprendizaje y portfolio. El usuario trabaja y busca salidas laborales en el ecosistema Angular + .NET, por lo que el stack debe coincidir con lo que se demanda en empresas. Ambas herramientas ya están instaladas en su máquina.

## Decisión

- **Backend:** ASP.NET Core Web API sobre **.NET 10 (LTS)**.
- **Frontend:** **Angular 21** con componentes standalone y signals.
- **ORM:** Entity Framework Core 10.

## Alternativas consideradas

- **.NET 8 (LTS anterior):** más conservador, pero .NET 10 es el LTS actual y ya está instalado.
- **React/Vue + Node (NestJS, Express):** populares, pero fuera del stack objetivo laboral del usuario.
- **Blazor (full-stack .NET):** descartado porque el objetivo incluye dominar Angular.

## Consecuencias

- (+) Stack alineado con ofertas de trabajo reales del usuario.
- (+) Sin instalaciones extra: SDK 10.0.111 y Angular CLI 21.1.4 ya presentes.
- (−) Angular 21 es reciente: algunos tutoriales de internet pueden usar sintaxis antigua (NgModules); usaremos standalone + signals.
