// Préférences d'affichage de l'utilisateur connecté, partagées par l'application.
// Sans fournisseur (tests de composants isolés), les valeurs par défaut s'appliquent.
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchPreferences, savePreferences as savePreferencesService } from '../services/preferences';
import { DEFAULT_PREFERENCES, UserPreferences } from '../utils/preferences';
import { PreferencesContext } from './preferencesContextValue';

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let active = true;
    setPreferences(DEFAULT_PREFERENCES);
    if (!userId) return;
    fetchPreferences(userId)
      .then((loaded) => {
        if (active) setPreferences(loaded);
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
      setPreferences(await savePreferencesService(userId, next));
    },
    [userId]
  );

  return <PreferencesContext.Provider value={{ preferences, savePreferences }}>{children}</PreferencesContext.Provider>;
}
