import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  LucideDatabase,
  LucideLanguages,
  LucideLeaf,
  LucideMonitor,
  LucideMoon,
  LucideSun,
} from '@lucide/angular';
import { Language } from './core/i18n/language';
import { LanguageService } from './core/i18n/language-service';
import { ThemePreference } from './core/theme/theme';
import { ThemeService } from './core/theme/theme-service';

/** Respuesta del endpoint `/health` de la API. */
interface ApiHealth {
  status: string;
  mode: string;
}

/**
 * Pantalla provisional de la Fase 0: comprueba que el frontend habla con la API y que
 * el idioma y el tema funcionan. La interfaz real llega en la Fase 3.
 */
@Component({
  selector: 'ns-root',
  imports: [
    TranslocoPipe,
    LucideLeaf,
    LucideDatabase,
    LucideLanguages,
    LucideSun,
    LucideMoon,
    LucideMonitor,
  ],
  templateUrl: './app.html',
})
export class App {
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  protected readonly languages = this.languageService.available;
  protected readonly currentLanguage = this.languageService.current;

  protected readonly themes = this.themeService.available;
  protected readonly currentTheme = this.themeService.preference;

  /** `httpResource` expone la petición como signals: `isLoading()`, `hasValue()`, `value()`. */
  protected readonly health = httpResource<ApiHealth>(() => '/health');

  protected useLanguage(language: Language): void {
    this.languageService.use(language);
  }

  protected useTheme(theme: ThemePreference): void {
    this.themeService.use(theme);
  }
}
