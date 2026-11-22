// Préférences d'affichage de l'utilisateur connecté, partagées par l'application.
// Sans fournisseur (tests de composants isolés), les valeurs par défaut s'appliquent.
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  fetchPreferences,
  markTourCompleted as markTourCompletedService,
  markVersionSeen as markVersionSeenService,
  savePreferences as savePreferencesService,
} from '../services/preferences';
import { APP_VERSION } from '../utils/appInfo';
import { DEFAULT_PREFERENCES, UserPreferences } from '../utils/preferences';
import { applyTheme, readStoredTheme } from '../utils/theme';
import { PreferencesContext, PreferencesStatus } from './preferencesContextValue';

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Sans préférences enregistrées, le thème est celui choisi sur cet appareil
  const deviceDefaults = (): UserPreferences => ({ ...DEFAULT_PREFERENCES, theme: readStoredTheme() });
  const [preferences, setPreferences] = useState<UserPreferences>(deviceDefaults);
  // Compte dont la lecture est terminée (ligne existante ou non) et son issue.
  // L'état est calculé à chaque rendu : au moment où un compte se connecte, il vaut
  // « loading » tout de suite, jamais « ready » avec les valeurs d'un autre compte.
  const [loaded, setLoaded] = useState<{ userId: string; failed: boolean } | null>(null);
  const status: PreferencesStatus = !userId
    ? 'ready'
    : loaded?.userId !== userId
      ? 'loading'
      : loaded.failed
        ? 'error'
        : 'ready';

  useEffect(() => {
    let active = true;
    setPreferences(deviceDefaults());
    if (!userId) return;
    fetchPreferences(userId)
      .then((saved) => {
        if (!active) return;
        if (saved) {
          setPreferences(saved);
          // Le thème du compte s'applique aussi sur cet appareil
          applyTheme(saved.theme);
        }
        setLoaded({ userId, failed: false });
      })
      .catch((error) => {
        // Non bloquant : l'application reste utilisable avec l'affichage par défaut
        console.error('Error loading preferences:', error);
        if (active) setLoaded({ userId, failed: true });
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

  const markTourCompleted = useCallback(async () => {
    if (!userId) return;
    const completedAt = await markTourCompletedService(userId, APP_VERSION);
    setPreferences((current) => ({ ...current, tourCompletedAt: completedAt, lastSeenVersion: APP_VERSION }));
  }, [userId]);

  const markVersionSeen = useCallback(
    async (version: string) => {
      if (!userId) return;
      await markVersionSeenService(userId, version);
      setPreferences((current) => ({ ...current, lastSeenVersion: version }));
    },
    [userId]
  );

  return (
    <PreferencesContext.Provider value={{ preferences, status, savePreferences, markTourCompleted, markVersionSeen }}>
      {children}
    </PreferencesContext.Provider>
  );
}
