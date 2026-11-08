// En-tête global de l'application
// Affiche le logo, le nom de l'app et le menu du compte (profil, compte, déconnexion)
import { useAuth } from '../../contexts/useAuth';
import { navigateTo } from '../../utils/navigation';
import { AccountMenu } from './AccountMenu';
import logo from '../../Image/logo.png';
export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 card-kaizen border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="w-20 h-10 rounded-full overflow-hidden  flex items-center justify-center bg-white/10">             
              <img src={logo} alt="CalTrack Logo" className="w-16 h-16 object-contain" />
            </div>
            <div>
              <h1 className="text-xl text-shonen-700 ">CalTrack</h1>
              <p className="text-xs text-gray-600">Suivi calorique personnalisé</p>
            </div>
          </div>

          {profile && (
            <AccountMenu email={profile.email} onNavigate={navigateTo} onSignOut={() => signOut()} />
          )}
        </div>
      </div>
    </header>
  );
}
