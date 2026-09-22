import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, Language, isLanguage } from './language';

const STORAGE_KEY = 'naturesql.language';

/**
 * Única responsabilidad: decidir y recordar el idioma de la interfaz.
 * Transloco se encarga de traducir; este servicio solo elige, persiste y mantiene
 * sincronizado el atributo `lang` del documento (lo usan lectores de pantalla y el navegador).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly available = AVAILABLE_LANGUAGES;

  private readonly currentLanguage = signal<Language>(DEFAULT_LANGUAGE);

  /** Solo lectura hacia fuera: cambiar de idioma pasa siempre por `use()`. */
  readonly current = this.currentLanguage.asReadonly();

  constructor() {
    this.use(this.resolveInitialLanguage());
  }

  use(language: Language): void {
    this.currentLanguage.set(language);
    this.transloco.setActiveLang(language);
    this.document.documentElement.lang = language;
    this.document.defaultView?.localStorage.setItem(STORAGE_KEY, language);
  }

  /** Preferencia guardada → idioma del navegador → español. */
  private resolveInitialLanguage(): Language {
    const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    if (isLanguage(stored)) {
      return stored;
    }

    const browserLanguage = this.document.defaultView?.navigator.language.split('-')[0] ?? null;
    return isLanguage(browserLanguage) ? browserLanguage : DEFAULT_LANGUAGE;
  }
}
