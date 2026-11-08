// Préférences d'affichage de l'utilisateur connecté, partagées par l'application.
// Sans fournisseur (tests de composants isolés), les valeurs par défaut s'appliquent.
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchPreferences, savePreferences as savePreferencesService } from '../services/preferences';
import { DEFAULT_PREFERENCES, UserPreferences } from '../utils/preferences';
import { applyTheme, readStoredTheme } from '../utils/theme';
import { PreferencesContext } from './preferencesContextValue';

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Sans préférences enregistrées, le thème est celui choisi sur cet appareil
  const deviceDefaults = (): UserPreferences => ({ ...DEFAULT_PREFERENCES, theme: readStoredTheme() });
  const [preferences, setPreferences] = useState<UserPreferences>(deviceDefaults);

  useEffect(() => {
    let active = true;
    setPreferences(deviceDefaults());
    if (!userId) return;
    fetchPreferences(userId)
      .then((loaded) => {
        if (!active || !loaded) return;
        setPreferences(loaded);
        // Le thème du compte s'applique aussi sur cet appareil
        applyTheme(loaded.theme);
      })
      .catch((error) => {
        // Non bloquant : l'application reste utilisable avec l'affichage par défaut
        console.error('Error loading preferences:', error);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const savePreferences = useCallback(
    async (next: UserPreferences) => {
      if (!userId) return;
      const saved = await savePreferencesService(userId, next);
      setPreferences(saved);
      applyTheme(saved.theme);
    },
    [userId]
  );

  return <PreferencesContext.Provider value={{ preferences, savePreferences }}>{children}</PreferencesContext.Provider>;
}
