// Navigation entre les vues de l'application (sans routeur).
// Les composants profonds (bandeau du tableau de bord, menu du compte…)
// demandent un changement de vue via un événement global écouté par App.

/** Vues principales (barre de navigation) et pages du menu du compte */
export type AppView = 'dashboard' | 'trends' | 'goal' | 'profile' | 'account' | 'settings' | 'about';

/** Sections de la page « À propos » */
export type AboutSection = 'app' | 'health' | 'data' | 'sources';

export const ABOUT_SECTIONS: readonly AboutSection[] = ['app', 'health', 'data', 'sources'];

export const NAVIGATE_EVENT = 'caltrack:navigate';

export interface NavigateEventDetail {
  view: AppView;
  /** Section à afficher (page « À propos ») */
  section?: AboutSection;
}

const APP_VIEWS: readonly AppView[] = ['dashboard', 'trends', 'goal', 'profile', 'account', 'settings', 'about'];

export function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && (APP_VIEWS as readonly string[]).includes(value);
}

export function isAboutSection(value: unknown): value is AboutSection {
  return typeof value === 'string' && (ABOUT_SECTIONS as readonly string[]).includes(value);
}

/** Demande l'affichage d'une vue (et, pour « À propos », d'une section) */
export function navigateTo(view: AppView, section?: AboutSection) {
  const detail: NavigateEventDetail = section ? { view, section } : { view };
  window.dispatchEvent(new CustomEvent<NavigateEventDetail>(NAVIGATE_EVENT, { detail }));
}
