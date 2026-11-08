// Barre de navigation principale
// Permet de naviguer entre les vues du quotidien : Tableau de bord, Tendances et
// Objectif. Le profil et le compte sont dans le menu de l'avatar (en-tête).
// - Ordinateur / tablette (≥ sm) : onglets en haut de page.
// - Mobile : barre d'onglets fixée en bas de l'écran, avec icône ET libellé
//   (auparavant, seules les icônes s'affichaient, sans nom accessible).
import { Home, Target, TrendingUp } from 'lucide-react';
import type { AppView } from '../../utils/navigation';

export type { AppView };

interface NavigationProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const tabs = [
  { id: 'dashboard' as const, label: 'Tableau de bord', shortLabel: 'Journal', icon: Home },
  { id: 'trends' as const, label: 'Tendances', shortLabel: 'Tendances', icon: TrendingUp },
  { id: 'goal' as const, label: 'Objectif', shortLabel: 'Objectif', icon: Target },
];

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <>
      {/* Ordinateur / tablette : onglets en haut */}
      <nav aria-label="Navigation principale" className="hidden sm:block card-kaizen border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onViewChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-shonen-500 text-shonen-500'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile : barre d'onglets fixée en bas, toujours accessible au pouce */}
      <nav
        aria-label="Navigation principale"
        className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors ${
                  isActive ? 'text-shonen-500' : 'text-gray-500 active:text-gray-700'
                }`}
              >
                <Icon className="w-6 h-6" aria-hidden="true" />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
