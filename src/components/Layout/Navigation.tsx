// Barre de navigation principale
// Permet de naviguer entre les vues: Tableau de bord, Tendances et Paramètres
import { Home, TrendingUp, Settings as SettingsIcon, ChefHat } from 'lucide-react';

interface NavigationProps {
  currentView: 'dashboard' | 'fridge' | 'trends' | 'settings';
  onViewChange: (view: 'dashboard' | 'fridge' | 'trends' | 'settings') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const tabs = [
    { id: 'dashboard' as const, label: 'Tableau de bord', icon: Home },
    { id: 'fridge' as const, label: 'Cuisiner', icon: ChefHat },
    { id: 'trends' as const, label: 'Tendances', icon: TrendingUp },
    { id: 'settings' as const, label: 'Paramètres', icon: SettingsIcon },
  ];

  return (
    <nav className="card-kaizen border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-shonen-500 text-shonen-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
