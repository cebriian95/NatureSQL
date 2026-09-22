import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  DEFAULT_THEME_PREFERENCE,
  ResolvedTheme,
  THEME_PREFERENCES,
  ThemePreference,
  isThemePreference,
} from './theme';

const STORAGE_KEY = 'naturesql.theme';
const DARK_CLASS = 'dark';
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Única responsabilidad: resolver el tema efectivo y reflejarlo en el documento.
 *
 * `preference` es lo que el usuario eligió; `resolved` es un signal derivado que, cuando la
 * preferencia es `system`, sigue en vivo a la del sistema operativo. Un `effect` traduce ese
 * resultado a la clase `.dark` de <html>, que es de donde tira el variant de Tailwind.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly available = THEME_PREFERENCES;

  private readonly systemPrefersDark = signal(false);
  private readonly themePreference = signal<ThemePreference>(this.readStoredPreference());

  readonly preference = this.themePreference.asReadonly();

  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.themePreference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    this.watchSystemPreference();

    effect(() => {
      this.document.documentElement.classList.toggle(DARK_CLASS, this.resolved() === 'dark');
    });
  }

  use(preference: ThemePreference): void {
    this.themePreference.set(preference);
    this.document.defaultView?.localStorage.setItem(STORAGE_KEY, preference);
  }

  private watchSystemPreference(): void {
    const darkModeQuery = this.document.defaultView?.matchMedia?.(DARK_MEDIA_QUERY);
    if (!darkModeQuery) {
      return;
    }

    this.systemPrefersDark.set(darkModeQuery.matches);
    darkModeQuery.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));
  }

  private readStoredPreference(): ThemePreference {
    const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  }
}
