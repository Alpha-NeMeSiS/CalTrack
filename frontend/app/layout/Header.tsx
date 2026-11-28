// En-tête global de l'application
// Affiche le logo, le nom de l'app et le menu du compte (profil, compte, déconnexion).
// Le logo et le nom forment un bouton qui ramène au tableau de bord du jour.
import { useAuth } from '../contexts/useAuth';
import { navigateTo } from '../navigation';
import { AccountMenu } from './AccountMenu';
import logo from '../../shared/assets/brand/logo-mark.png';
interface HeaderProps {
  /** Retour au tableau de bord, sur la date du jour (géré par App) */
  onHome: () => void;
}

export function Header({ onHome }: HeaderProps) {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Le bouton est DANS le titre : un <h1> ne peut pas être dans un <button> */}
          <h1>
            <button
              type="button"
              onClick={onHome}
              aria-label="CalTrack, retour au tableau de bord"
              className="flex items-center rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
            >
              <img src={logo} alt="" aria-hidden="true" className="mr-3 h-10 w-10 object-contain" />
              <span>
                <span className="block font-display text-xl tracking-wide text-accent-700">CalTrack</span>
                <span className="block text-xs font-normal text-muted">Suivi calorique personnalisé</span>
              </span>
            </button>
          </h1>

          {profile && (
            <AccountMenu identity={profile} onNavigate={navigateTo} onSignOut={() => signOut()} />
          )}
        </div>
      </div>
    </header>
  );
}
