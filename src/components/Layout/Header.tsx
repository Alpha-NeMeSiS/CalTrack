import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 card-kaizen border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-kaizen-400 to-kaizen-600 rounded-lg flex items-center justify-center ring-2 ring-white/20">
              <span className="text-white text-xl">C</span>
            </div>
            <div>
              <h1 className="text-xl text-shonen-700">CalTrack</h1>
              <p className="text-xs text-gray-600">Suivi calorique personnalisé</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{profile.email}</span>
              </div>
            )}

            <button
              onClick={signOut}
              className="btn-shonen-accent flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
