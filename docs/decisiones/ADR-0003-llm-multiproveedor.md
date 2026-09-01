# ADR-0003: LLM multi-proveedor con API key del usuario (primero: Gemini)

- **Estado:** Aceptada
- **Fecha:** 2026-09-01

## Contexto

Necesitamos un LLM para traducir lenguaje natural a SQL. La gracia del producto es que **cada usuario usa su propia API key**: una empresa puede usar Claude, un usuario en casa GPT, otra empresa un modelo local autoalojado. El coste y la privacidad del modelo son del usuario final, no de la app.

## Decisión

- El acceso al LLM se define mediante una **interfaz propia** (`ILLMProvider`) en `Domain`, con una implementación por proveedor en `Infrastructure` (patrón *Strategy*):
  - **Gemini** → primera implementación (el desarrollador tiene API key gratuita).
  - **OpenAI**, **Claude** y **endpoint local (Ollama/OpenAI-compatible)** → fase 2.
- El usuario configura en la app: proveedor, API key, modelo y (si aplica) endpoint.
- Las API keys se guardan **cifradas** en la BD propia (ver ADR-0007) y jamás se devuelven al frontend ni aparecen en logs.
- El proveedor se selecciona en runtime según la configuración activa (no al compilar).

## Alternativas consideradas

- **Un único proveedor fijo (solo OpenAI):** más simple, pero rompe la propuesta de valor "cada uno usa su key/modelo".
- **Solo Ollama local:** gratis y privado, pero exige hardware potente y la calidad del SQL generado es menor; lo tendremos como opción, no como obligación.
- **Librerías agregadoras (ej. Semantic Kernel):** potente, pero añade una capa de abstracción prematura para un MVP; preferimos nuestra propia interfaz fina (y aprender más). Reevaluable en el futuro.

## Consecuencias

- (+) Propuesta de valor diferencial y muy realista (BYOK: *bring your own key*).
- (+) Ejercicio perfecto de interfaces, inyección de dependencias y factories en .NET.
- (−) Hay que normalizar diferencias entre APIs (formato de petición/respuesta, nombres de modelo, errores).
- (−) Cada proveedor nuevo requiere su implementación y sus pruebas.
