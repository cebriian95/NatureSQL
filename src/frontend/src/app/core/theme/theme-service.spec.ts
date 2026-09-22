import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme-service';

/**
 * jsdom (el DOM simulado en el que corren los tests) no implementa `matchMedia`,
 * así que lo sustituimos por uno falso que devuelve siempre la preferencia que le indiquemos.
 * Sin esto, ThemeService no podría preguntar al "sistema operativo".
 */
function fakeSystemPrefersDark(prefersDark: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches: prefersDark,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    fakeSystemPrefersDark(false);
    TestBed.configureTestingModule({});
  });

  it('sigue al sistema mientras el usuario no elija otra cosa', () => {
    fakeSystemPrefersDark(true);

    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('system');
    expect(theme.resolved()).toBe('dark');
  });

  it('una preferencia explícita gana sobre el sistema', () => {
    fakeSystemPrefersDark(true);
    const theme = TestBed.inject(ThemeService);

    theme.use('light');

    expect(theme.resolved()).toBe('light');
  });

  it('recuerda la preferencia entre sesiones', () => {
    localStorage.setItem('naturesql.theme', 'dark');

    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('dark');
  });

  it('ignora un valor guardado que no sea un tema válido', () => {
    localStorage.setItem('naturesql.theme', 'neon');

    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('system');
  });

  it('marca el documento con la clase que usa Tailwind para el modo oscuro', () => {
    const theme = TestBed.inject(ThemeService);

    theme.use('dark');
    // Los efectos no se ejecutan al instante: `tick()` procesa los pendientes.
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    theme.use('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
