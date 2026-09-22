/** Idiomas soportados por la interfaz. Añadir uno exige crear su JSON en `public/i18n/`. */
export const AVAILABLE_LANGUAGES = ['es', 'en'] as const;

export type Language = (typeof AVAILABLE_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'es';

export function isLanguage(value: string | null): value is Language {
  return value !== null && AVAILABLE_LANGUAGES.includes(value as Language);
}
