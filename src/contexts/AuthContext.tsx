// Contexte d'authentification
// Ce fichier expose AuthProvider + AuthContext pour accéder à l'utilisateur,
// au profil et aux méthodes d'auth (signIn, signUp, signOut, refreshProfile,
// mot de passe oublié, changement de mot de passe, suppression du compte).
// Le hook useAuth est dans ./useAuth.ts.
import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { openedFromPasswordRecoveryLink, supabase, Profile } from '../lib/supabase';

// Type du contexte d'authentification exposé aux composants
export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  /** true tant que la session ou le profil de l'utilisateur sont en cours de chargement */
  loading: boolean;
  /** Message d'erreur si le profil n'a pas pu être chargé (≠ « pas encore de profil ») */
  profileError: string | null;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** true quand l'utilisateur arrive depuis le lien « mot de passe oublié » */
  passwordRecovery: boolean;
  /** Envoie l'email de réinitialisation du mot de passe */
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  /** Définit un nouveau mot de passe pour l'utilisateur connecté */
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  /** Quitte l'écran « nouveau mot de passe » sans le changer */
  dismissPasswordRecovery: () => void;
  /** Supprime définitivement le compte et toutes ses données, puis déconnecte */
  deleteAccount: () => Promise<{ error: Error | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // États locaux pour l'utilisateur, le profil et le chargement
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromPasswordRecoveryLink);

  // Identifiant de l'utilisateur courant (undefined = session pas encore connue).
  // Sert à ignorer les événements qui ne changent pas d'utilisateur
  // (ex : rafraîchissement automatique du jeton toutes les heures) et les
  // réponses tardives d'un ancien utilisateur.
  const currentUserIdRef = useRef<string | null | undefined>(undefined);

  // Charge le profil utilisateur depuis la table 'profiles'
  const loadProfile = useCallback(async (userId: string) => {
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (currentUserIdRef.current !== userId) return; // l'utilisateur a changé entre-temps
      setProfile((data as Profile | null) ?? null);
    } catch (error) {
      console.error('Error loading profile:', error);
      if (currentUserIdRef.current !== userId) return;
      // On ne considère PAS l'utilisateur comme « sans profil » : sinon il serait
      // renvoyé vers l'onboarding (et pourrait écraser son profil existant).
      setProfile(null);
      setProfileError('Impossible de charger votre profil. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (currentUserIdRef.current === userId) {
        setLoading(false);
      }
    }
  }, []);

  // Applique une session reçue de Supabase
  const applySession = useCallback(
    (session: Session | null) => {
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      // Même utilisateur (rafraîchissement du jeton, doublon getSession/INITIAL_SESSION) :
      // ne rien recharger, pour ne pas réinitialiser l'interface.
      if (currentUserIdRef.current === nextUserId) {
        return;
      }

      currentUserIdRef.current = nextUserId;
      setUser(nextUser);
      setProfile(null);
      setProfileError(null);

      if (nextUser) {
        // Garder l'écran de chargement pendant le chargement du profil : sinon
        // l'onboarding s'affiche brièvement juste après la connexion.
        setLoading(true);
        void loadProfile(nextUser.id);
      } else {
        setLoading(false);
      }
    },
    [loadProfile]
  );

  // Au montage, récupérer la session et écouter les changements d'état d'auth
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (active) applySession(session);
      })
      .catch((error) => {
        console.error('Error getting session:', error);
        if (active) applySession(null);
      });

    // Souscrire aux changements d'auth (connexion/déconnexion).
    // Supabase déconseille d'appeler d'autres méthodes Supabase directement dans
    // ce callback (risque de blocage) : le traitement est différé.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setTimeout(() => {
        if (active) applySession(session);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  // Forcer le rechargement du profil courant
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  // Inscription avec email/mot de passe via Supabase
  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Connexion avec email/mot de passe via Supabase
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { error };
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Déconnexion : l'état local est vidé même si l'appel réseau échoue
  const signOut = async (scope: 'global' | 'local' = 'global') => {
    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error) console.error('Error signing out:', error);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setPasswordRecovery(false);
      applySession(null);
    }
  };

  // Mot de passe oublié : Supabase envoie un lien qui ramène sur l'application.
  // L'URL de retour doit être autorisée dans Supabase (Authentication → URL Configuration).
  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      return { error: error ?? null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error };
      setPasswordRecovery(false);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const dismissPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  // Suppression du compte (RGPD) : la fonction SQL delete_my_account() supprime
  // l'utilisateur connecté ; ses données sont effacées en cascade.
  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { error: new Error(error.message) };
    } catch (error) {
      return { error: error as Error };
    }
    // Le compte n'existe plus : on ne révoque que la session locale.
    await signOut('local');
    return { error: null };
  };

  // Fournit le contexte aux composants enfants
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        signUp,
        signIn,
        signOut: () => signOut(),
        refreshProfile,
        passwordRecovery,
        requestPasswordReset,
        updatePassword,
        dismissPasswordRecovery,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
