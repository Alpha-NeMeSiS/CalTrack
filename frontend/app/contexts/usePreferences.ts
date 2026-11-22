import { useContext } from 'react';
import { PreferencesContext } from './preferencesContextValue';

/** Préférences d'affichage (valeurs par défaut hors fournisseur) */
export function usePreferences() {
  return useContext(PreferencesContext);
}
