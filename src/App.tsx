// Composant racine de l'application
// Gère l'authentification et la navigation entre vues (dashboard, tendances, paramètres)
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { OnboardingForm } from './components/Onboarding/OnboardingForm';
import { Header } from './components/Layout/Header';
import { Navigation } from './components/Layout/Navigation';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WeeklyTrends } from './components/Stats/WeeklyTrends';
import { Settings } from './components/Settings/Settings';
import { getTodayDate } from './utils/date';

function AppContent() {
  // Récupère l'état d'authentification et le profil utilisateur
  const { user, profile, loading, profileError, refreshProfile, signOut } = useAuth();
  const [retryingProfile, setRetryingProfile] = useState(false);
  // Mode d'auth (login / signup) pour l'écran d'authentification
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  // Vue courante affichée dans l'application: dashboard, tendances ou paramètres
  const [currentView, setCurrentView] = useState<'dashboard' | 'trends' | 'settings'>('dashboard');
  const [dashboardDate, setDashboardDate] = useState<string>(() => getTodayDate());

  // Écouteur global pour naviguer vers les paramètres depuis d'autres composants
  useEffect(() => {
    const handleNavigateToSettings = () => {
      setCurrentView('settings');
    };

    const handleNavigateToBoard = () => {
      setCurrentView('dashboard');
    };

    window.addEventListener('navigate-to-settings', handleNavigateToSettings);
    window.addEventListener('navigate-to-board', handleNavigateToBoard);

    return () => {
      window.removeEventListener('navigate-to-settings', handleNavigateToSettings);
      window.removeEventListener('navigate-to-board', handleNavigateToBoard);
    };
  }, []);

  // Affiche un écran de chargement tant que l'authentification/profile n'est pas prête
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600">Chargement...</div>
        </div>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher le formulaire de connexion / inscription
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        {authMode === 'login' ? (
          <LoginForm onToggle={() => setAuthMode('signup')} />
        ) : (
          <SignupForm onToggle={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  // Le profil n'a pas pu être chargé (erreur réseau, Supabase indisponible…) :
  // ne PAS afficher l'onboarding, qui risquerait d'écraser un profil existant.
  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div role="alert" className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-red-700 mb-6">{profileError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
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
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <OnboardingForm />
      </div>
    );
  }

  // Vue principale de l'application lorsque l'utilisateur est connecté et profil rempli
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation currentView={currentView} onViewChange={setCurrentView} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <Dashboard activeDate={dashboardDate} onActiveDateChange={setDashboardDate} />
        )}
        {currentView === 'trends' && <WeeklyTrends />}
        {currentView === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

// Le composant App enveloppe AppContent avec le fournisseur d'authentification
// (AuthProvider) pour rendre le contexte disponible dans toute l'application.
