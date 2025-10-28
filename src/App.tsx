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

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentView, setCurrentView] = useState<'dashboard' | 'trends' | 'settings'>('dashboard');

  useEffect(() => {
    const handleNavigateToSettings = () => {
      setCurrentView('settings');
    };

    window.addEventListener('navigate-to-settings', handleNavigateToSettings);
    return () => window.removeEventListener('navigate-to-settings', handleNavigateToSettings);
  }, []);

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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <OnboardingForm />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation currentView={currentView} onViewChange={setCurrentView} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && <Dashboard />}
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
