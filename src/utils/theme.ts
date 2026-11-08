// Thème clair / sombre / système.
// Le thème s'applique en posant la classe « dark » sur <html> : les couleurs
// passent par des variables CSS (theme.palette.js). Le choix est mémorisé sur
// l'appareil (localStorage, lu dès le chargement par index.html pour éviter un
// flash) et dans les préférences du compte (user_preferences.theme).

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'caltrack-theme';
const THEME_COLORS = { light: '#19b887', dark: '#111827' } as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Thème effectif selon le choix et le réglage de l'appareil */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** Choix mémorisé sur cet appareil (« system » par défaut) */
export function readStoredTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemMediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
}

function setDocumentTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

let stopFollowingSystem: (() => void) | null = null;

/**
 * Applique un thème. En mode « system », suit les changements du réglage de
 * l'appareil. `persist: false` sert à l'aperçu (sans mémoriser le choix).
 */
export function applyTheme(preference: ThemePreference, { persist = true }: { persist?: boolean } = {}) {
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Stockage indisponible (navigation privée…) : le thème s'applique quand même
    }
  }

  stopFollowingSystem?.();
  stopFollowingSystem = null;

  const media = systemMediaQuery();
  const update = () => setDocumentTheme(resolveTheme(preference, media?.matches ?? false));
  update();

  if (preference === 'system' && media) {
    media.addEventListener('change', update);
    stopFollowingSystem = () => media.removeEventListener('change', update);
  }
}
