import { createContext } from 'react';
import { DEFAULT_PREFERENCES, UserPreferences } from '../../features/settings/preferences';

export type PreferencesStatus = 'loading' | 'ready' | 'error';

export interface PreferencesContextValue {
  preferences: UserPreferences;
  /** Lecture en cours, terminée (ligne existante ou non) ou en échec */
  status: PreferencesStatus;
  /** Enregistre les préférences (lève une erreur en cas d'échec) */
  savePreferences: (preferences: UserPreferences) => Promise<void>;
  /** Fin de la visite guidée : visite et version actuelle marquées vues */
  markTourCompleted: () => Promise<void>;
  /** Nouveautés de cette version vues */
  markVersionSeen: (version: string) => Promise<void>;
}

// Valeur par défaut : utilisée hors fournisseur (tests de composants isolés)
export const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  status: 'ready',
  savePreferences: async () => {},
  markTourCompleted: async () => {},
  markVersionSeen: async () => {},
});
