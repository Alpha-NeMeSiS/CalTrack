// Navigation entre les vues de l'application (sans routeur).
// Les composants profonds (bandeau du tableau de bord, menu du compte…)
// demandent un changement de vue via un événement global écouté par App.

/** Vues principales (barre de navigation) et pages du menu du compte */
export type AppView = 'dashboard' | 'trends' | 'goal' | 'profile' | 'account' | 'settings' | 'about' | 'guide';

/** Sections de la page « À propos » */
export type AboutSection = 'app' | 'health' | 'data' | 'sources';

export const ABOUT_SECTIONS: readonly AboutSection[] = ['app', 'health', 'data', 'sources'];

/** Sections de la page « Guide » */
export type GuideSection = 'start' | 'meals' | 'water' | 'weight' | 'goal' | 'trends' | 'settings' | 'install';

export const GUIDE_SECTIONS: readonly GuideSection[] = ['start', 'meals', 'water', 'weight', 'goal', 'trends', 'settings', 'install'];

/** Pages d'information ouvertes depuis le pied de page */
export type InfoPageName = 'about' | 'guide';

export const NAVIGATE_EVENT = 'caltrack:navigate';

export interface NavigateEventDetail {
  view: AppView;
  /** Section à afficher (pages « À propos » et « Guide ») */
  section?: AboutSection | GuideSection;
}

const APP_VIEWS: readonly AppView[] = ['dashboard', 'trends', 'goal', 'profile', 'account', 'settings', 'about', 'guide'];

export function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && (APP_VIEWS as readonly string[]).includes(value);
}

export function isAboutSection(value: unknown): value is AboutSection {
  return typeof value === 'string' && (ABOUT_SECTIONS as readonly string[]).includes(value);
}

export function isGuideSection(value: unknown): value is GuideSection {
  return typeof value === 'string' && (GUIDE_SECTIONS as readonly string[]).includes(value);
}

/** Demande l'affichage d'une vue (et, pour « À propos » ou « Guide », d'une section) */
export function navigateTo(view: AppView, section?: AboutSection | GuideSection) {
  const detail: NavigateEventDetail = section ? { view, section } : { view };
  window.dispatchEvent(new CustomEvent<NavigateEventDetail>(NAVIGATE_EVENT, { detail }));
}
