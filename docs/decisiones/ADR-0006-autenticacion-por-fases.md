# ADR-0006: Autenticación por fases — MVP sin login, JWT en fase 2

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

¿Necesita la app usuarios con registro/login? El MVP persigue validar el núcleo (Text-to-SQL) cuanto antes, pero la autenticación JWT es una competencia muy demandada laboralmente y formativa (interceptors en Angular, middleware en .NET).

## Decisión

- **MVP (fase 1): sin login.** La app asume un único usuario (el que la ejecuta). Una sola configuración activa de conexión y de LLM.
- **Fase 2: JWT.** Registro/login, tokens JWT, endpoints protegidos en .NET y guard + interceptor en Angular. La configuración y el historial pasan a ser por usuario.
- La estructura de datos (tablas de configuración, historial) se diseña **ya con `UserId` preparado** para no rehacerla en la fase 2.

## Alternativas consideradas

- **JWT desde el inicio:** retrasa el núcleo del producto; el riesgo del proyecto está en el Text-to-SQL, no en el login.
- **Sin autenticación nunca:** aceptable para app personal, pero pierde valor como portfolio y como producto.
- **Identity completo / OAuth externo (Google, GitHub):** excesivo para la fase 2; evaluable más adelante.

## Consecuencias

- (+) El MVP llega antes y se centra en lo diferencial.
- (+) JWT como fase dedicada = aprendizaje profundo y bien acotado.
- (−) Hay que recordar el `UserId` en el modelo de datos para no pagar deuda técnica.
