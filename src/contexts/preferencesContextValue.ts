import { createContext } from 'react';
import { DEFAULT_PREFERENCES, UserPreferences } from '../utils/preferences';

export interface PreferencesContextValue {
  preferences: UserPreferences;
  /** Enregistre les préférences (lève une erreur en cas d'échec) */
  savePreferences: (preferences: UserPreferences) => Promise<void>;
}

// Valeur par défaut : utilisée hors fournisseur (tests de composants isolés)
export const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  savePreferences: async () => {},
});
