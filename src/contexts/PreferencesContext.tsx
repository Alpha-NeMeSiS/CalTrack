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
  // « ready » une fois la lecture terminée, qu'une ligne existe ou non
  const [status, setStatus] = useState<PreferencesStatus>(userId ? 'loading' : 'ready');

  useEffect(() => {
    let active = true;
    setPreferences(deviceDefaults());
    if (!userId) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    fetchPreferences(userId)
      .then((loaded) => {
        if (!active) return;
        if (loaded) {
          setPreferences(loaded);
          // Le thème du compte s'applique aussi sur cet appareil
          applyTheme(loaded.theme);
        }
        setStatus('ready');
      })
      .catch((error) => {
        // Non bloquant : l'application reste utilisable avec l'affichage par défaut
        console.error('Error loading preferences:', error);
        if (active) setStatus('error');
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
