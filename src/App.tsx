// Composant racine de l'application
// Gère l'authentification et la navigation entre vues (dashboard, tendances, paramètres)
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/Auth/LoginForm';
import { SignupForm } from './components/Auth/SignupForm';
import { OnboardingForm } from './components/Onboarding/OnboardingForm';
import { Header } from './components/Layout/Header';
import { Navigation } from './components/Layout/Navigation';
import { Dashboard } from './components/Dashboard/Dashboard';
import { WeeklyTrends } from './components/Stats/WeeklyTrends';
import { Settings } from './components/Settings/Settings';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function AppContent() {
  // Récupère l'état d'authentification et le profil utilisateur
  const { user, profile, loading } = useAuth();
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
