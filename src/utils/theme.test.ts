import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readStoredTheme, resolveTheme, THEME_STORAGE_KEY } from './theme';

/** Simule le réglage clair / sombre de l'appareil */
function mockSystemTheme(initialDark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: initialDark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  return {
    setDark(dark: boolean) {
      media.matches = dark;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

const isDark = () => document.documentElement.classList.contains('dark');

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.head.innerHTML = '<meta name="theme-color" content="#19b887" />';
});

afterEach(() => {
  applyTheme('light', { persist: false }); // retire l'écoute du réglage système
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('résout le thème effectif', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('applique et mémorise un thème forcé', () => {
    mockSystemTheme(false);
    applyTheme('dark');

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#111827');
  });

  it("suit le réglage de l'appareil en mode automatique", () => {
    const system = mockSystemTheme(false);
    applyTheme('system');
    expect(isDark()).toBe(false);

    system.setDark(true);
    expect(isDark()).toBe(true);

    // Passer en thème forcé arrête de suivre l'appareil
    applyTheme('light');
    expect(system.listenerCount()).toBe(0);
    system.setDark(true);
    expect(isDark()).toBe(false);
  });

  it("n'enregistre pas un aperçu", () => {
    mockSystemTheme(false);
    applyTheme('dark', { persist: false });
    expect(isDark()).toBe(true);
    expect(readStoredTheme()).toBe('system');
  });
});
