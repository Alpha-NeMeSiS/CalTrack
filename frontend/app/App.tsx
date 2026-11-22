// Composant racine de l'application
// Gère l'authentification et la navigation entre vues (tableau de bord, tendances,
// objectif, et profil / compte depuis le menu de l'avatar)
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { LoginForm } from '../features/auth/LoginForm';
import { SignupForm } from '../features/auth/SignupForm';
import { PasswordRecoveryScreen } from '../features/auth/PasswordRecoveryScreen';
import { AuthBrand } from '../features/auth/AuthBrand';
import { OnboardingForm } from '../features/onboarding/OnboardingForm';
import { Header } from './layout/Header';
import { AuthNoticeBanner } from './layout/AuthNoticeBanner';
import { Navigation } from './layout/Navigation';
import { Dashboard } from '../features/journal/Dashboard';
import { WeeklyTrends } from '../features/stats/WeeklyTrends';
import { GoalPage } from '../features/goals/GoalPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { AccountPage } from '../features/account/AccountPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AboutPage } from '../features/about/AboutPage';
import { GuidePage } from '../features/guide/GuidePage';
import { AppFooter } from './layout/AppFooter';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { usePreferences } from './contexts/usePreferences';
import { WhatsNewDialog } from '../features/whats-new/WhatsNewDialog';
import { RELEASES } from '../features/whats-new/releaseNotes';
import { APP_VERSION } from './appInfo';
import { isNewerVersion, unseenReleases } from '../features/whats-new/releases';
import { getTodayDate } from '../shared/date';
import {
  AboutSection,
  AppView,
  GuideSection,
  InfoPageName,
  isAboutSection,
  isAppView,
  isGuideSection,
  NAVIGATE_EVENT,
  NavigateEventDetail,
} from './navigation';

function AppScreens() {
  // Récupère l'état d'authentification et le profil utilisateur
  const { user, profile, loading, profileError, refreshProfile, signOut, passwordRecovery } = useAuth();
  const [retryingProfile, setRetryingProfile] = useState(false);
  // Mode d'auth (login / signup) pour l'écran d'authentification
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  // Vue courante : tableau de bord, tendances, objectif, profil ou compte
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  // Page « À propos » : section demandée (connecté) ; sans connexion, page ouverte ou non
  const [aboutSection, setAboutSection] = useState<AboutSection | undefined>(undefined);
  // Chaque demande d'ouverture relance le défilement, même vers la même section
  const [aboutRequest, setAboutRequest] = useState(0);
  const [guideSection, setGuideSection] = useState<GuideSection | undefined>(undefined);
  const [guideRequest, setGuideRequest] = useState(0);
  // Sans compte : page d'information ouverte depuis le pied de page (ou aucune)
  const [guestInfo, setGuestInfo] = useState<{ page: InfoPageName; section?: AboutSection } | null>(null);
  const [dashboardDate, setDashboardDate] = useState<string>(() => getTodayDate());

  // Au lancement : visite guidée si elle n'a pas été vue, sinon « Quoi de neuf ? »
  // après une mise à jour. Jamais les deux dans la même session.
  const { preferences, status: preferencesStatus, markTourCompleted, markVersionSeen } = usePreferences();
  const [tourRequest, setTourRequest] = useState<'auto' | 'manual' | null>(null);
  const [autoTourThisSession, setAutoTourThisSession] = useState(false);
  const [whatsNewClosed, setWhatsNewClosed] = useState(false);
  const startupReady = Boolean(user && profile) && preferencesStatus === 'ready';

  // Nouvelle session (autre compte) : on repart de zéro
  useEffect(() => {
    setTourRequest(null);
    setAutoTourThisSession(false);
    setWhatsNewClosed(false);
  }, [user?.id]);

  useEffect(() => {
    if (!startupReady || autoTourThisSession || preferences.tourCompletedAt !== null) return;
    setAutoTourThisSession(true);
    setTourRequest('auto');
  }, [startupReady, autoTourThisSession, preferences.tourCompletedAt]);

  const handleTourFinish = () => {
    const mode = tourRequest;
    setTourRequest(null);
    // Visite automatique : enregistrée (visite + version actuelle) ; un échec ne bloque rien
    if (mode === 'auto') markTourCompleted().catch((error) => console.error('Visite non enregistrée :', error));
  };

  const showWhatsNew =
    startupReady &&
    !autoTourThisSession &&
    tourRequest === null &&
    !whatsNewClosed &&
    preferences.tourCompletedAt !== null &&
    isNewerVersion(APP_VERSION, preferences.lastSeenVersion);

  // « Revoir la visite » (Guide) : retour au journal, visite relancée sans rien enregistrer
  const startTourReplay = () => {
    setCurrentView('dashboard');
    setTourRequest('manual');
  };

  const openInfoPage = (page: InfoPageName, section?: AboutSection) => {
    if (page === 'guide') {
      setGuideSection(undefined);
      setGuideRequest((n) => n + 1);
    } else {
      setAboutSection(section);
      setAboutRequest((n) => n + 1);
    }
    setCurrentView(page);
  };

  const closeWhatsNew = () => {
    setWhatsNewClosed(true);
    markVersionSeen(APP_VERSION).catch((error) => console.error('Version vue non enregistrée :', error));
  };

  // Changement de vue demandé par un composant (menu du compte, bandeau d'objectif…)
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const detail = (event as CustomEvent<NavigateEventDetail>).detail;
      if (!isAppView(detail?.view)) return;
      setCurrentView(detail.view);
      if (detail.view === 'about') {
        setAboutSection(isAboutSection(detail.section) ? detail.section : undefined);
        setAboutRequest((n) => n + 1);
      }
      if (detail.view === 'guide') {
        setGuideSection(isGuideSection(detail.section) ? detail.section : undefined);
        setGuideRequest((n) => n + 1);
      }
    };
    window.addEventListener(NAVIGATE_EVENT, handleNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, handleNavigate);
  }, []);

  // Nouvelle vue : revenir en haut de page (sauf « À propos » ouverte sur une
  // section : la page défile elle-même jusqu'à la section)
  useEffect(() => {
    if ((currentView === 'about' && aboutSection) || (currentView === 'guide' && guideSection)) return;
    window.scrollTo?.({ top: 0 });
    // aboutSection et guideSection lus au changement de vue seulement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Affiche un écran de chargement tant que l'authentification/profile n'est pas prête
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-muted">Chargement...</div>
        </div>
      </div>
    );
  }

  // Arrivée depuis le lien « mot de passe oublié » : choisir le nouveau mot de passe
  if (user && passwordRecovery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center justify-center p-4">
        <AuthBrand />
        <PasswordRecoveryScreen />
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher le formulaire de connexion / inscription
  // (ou la page « À propos », ouverte depuis le pied de page)
  if (!user) {
    const openGuestInfo = (page: InfoPageName, section?: AboutSection) => setGuestInfo({ page, section });
    if (guestInfo) {
      return (
        <div className="min-h-screen bg-canvas px-4 py-6 sm:py-10">
          {guestInfo.page === 'guide' ? (
            <GuidePage signedIn={false} onBack={() => setGuestInfo(null)} />
          ) : (
            <AboutPage section={guestInfo.section} signedIn={false} onBack={() => setGuestInfo(null)} />
          )}
          <AppFooter onOpen={openGuestInfo} />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center justify-center p-4">
        <AuthBrand />
        {authMode === 'login' ? (
          <LoginForm onToggle={() => setAuthMode('signup')} />
        ) : (
          <SignupForm onToggle={() => setAuthMode('login')} />
        )}
        <AppFooter onOpen={openGuestInfo} />
      </div>
    );
  }

  // Le profil n'a pas pu être chargé (erreur réseau, Supabase indisponible…) :
  // ne PAS afficher l'onboarding, qui risquerait d'écraser un profil existant.
  if (profileError) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div role="alert" className="w-full max-w-md panel p-8 text-center">
          <p className="text-danger-700 mb-6">{profileError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex-1 py-2 px-4 btn-secondary font-medium rounded-md"
            >
              Se déconnecter
            </button>
            <button
              type="button"
              disabled={retryingProfile}
              onClick={async () => {
                setRetryingProfile(true);
                try {
                  await refreshProfile();
                } finally {
                  setRetryingProfile(false);
                }
              }}
              className="flex-1 py-2 px-4 btn-primary font-medium rounded-md"
            >
              {retryingProfile ? 'Nouvelle tentative…' : 'Réessayer'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si l'utilisateur est connecté mais n'a pas de profil complet, afficher le formulaire d'onboarding
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <OnboardingForm />
      </div>
    );
  }

  // Vue principale de l'application lorsque l'utilisateur est connecté et profil rempli
  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <Navigation currentView={currentView} onViewChange={setCurrentView} />

      {/* pb-28 sur mobile : place pour la barre d'onglets fixée en bas et le bouton « Ajouter » */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 sm:py-8">
        {currentView === 'dashboard' && (
          <Dashboard
            activeDate={dashboardDate}
            onActiveDateChange={setDashboardDate}
            tourActive={tourRequest !== null}
            onTourFinish={handleTourFinish}
          />
        )}
        {currentView === 'trends' && <WeeklyTrends />}
        {currentView === 'goal' && <GoalPage />}
        {currentView === 'profile' && <ProfilePage />}
        {currentView === 'account' && <AccountPage />}
        {currentView === 'settings' && <SettingsPage />}
        {currentView === 'about' && (
          <AboutPage section={aboutSection} scrollKey={aboutRequest} signedIn onOpenAccount={() => setCurrentView('account')} />
        )}
        {currentView === 'guide' && (
          <GuidePage section={guideSection} scrollKey={guideRequest} signedIn onReplayTour={startTourReplay} />
        )}

        {/* pb-8 sur mobile : le bouton flottant « Ajouter un aliment » ne recouvre pas le texte */}
        <AppFooter
          showAttribution
          className="pb-8 sm:pb-2"
          onOpen={openInfoPage}
        />
      </main>

      {showWhatsNew && (
        <WhatsNewDialog releases={unseenReleases(RELEASES, preferences.lastSeenVersion)} onClose={closeWhatsNew} />
      )}
    </div>
  );
}

// Message des liens d'authentification (au-dessus de tous les écrans) + écran courant
function AppContent() {
  return (
    <>
      <AuthNoticeBanner />
      <AppScreens />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <AppContent />
      </PreferencesProvider>
    </AuthProvider>
  );
}

// Le composant App enveloppe AppContent avec le fournisseur d'authentification
// (AuthProvider) pour rendre le contexte disponible dans toute l'application.
