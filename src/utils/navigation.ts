// Navigation entre les vues de l'application (sans routeur).
// Les composants profonds (bandeau du tableau de bord, menu du compte…)
// demandent un changement de vue via un événement global écouté par App.

/** Vues principales (barre de navigation) et pages du menu du compte */
export type AppView = 'dashboard' | 'trends' | 'goal' | 'profile' | 'account';

export const NAVIGATE_EVENT = 'caltrack:navigate';

export interface NavigateEventDetail {
  view: AppView;
}

const APP_VIEWS: readonly AppView[] = ['dashboard', 'trends', 'goal', 'profile', 'account'];

export function isAppView(value: unknown): value is AppView {
  return typeof value === 'string' && (APP_VIEWS as readonly string[]).includes(value);
}

/** Demande l'affichage d'une vue */
export function navigateTo(view: AppView) {
  window.dispatchEvent(new CustomEvent<NavigateEventDetail>(NAVIGATE_EVENT, { detail: { view } }));
}
