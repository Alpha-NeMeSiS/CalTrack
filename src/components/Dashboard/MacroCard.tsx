// Carte affichant la consommation vs objectif pour un macronutriment
import type { MacroDisplay } from '../../utils/preferences';

interface MacroCardProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
  /** « grams » : consommé / objectif ; « percent » : % de l'objectif atteint */
  display?: MacroDisplay;
}

export function MacroCard({ label, consumed, target, unit, color, display = 'grams' }: MacroCardProps) {
  // Pourcentage rempli de la barre (clampé entre 0 et 100)
  const percentage = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  // Quantité restante avant d'atteindre l'objectif
  const remaining = Math.max((target || 0) - consumed, 0);

  return (
    <div className="bg-surface p-4 rounded-lg border border-line-emphasis">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-body">{label}</span>
        <span className="text-xs text-subtle">{unit}</span>
      </div>

      <div className="mb-2">
        {display === 'percent' ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink">
              {target > 0 ? Math.round((consumed / target) * 100) : 0} %
            </span>
            <span className="text-xs text-subtle">
              {Math.round(consumed)} / {Math.round(target)} {unit}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-ink">{Math.round(consumed)}</span>
            <span className="text-sm text-subtle">/ {Math.round(target)}</span>
          </div>
        )}
      </div>

      <div className="relative w-full h-2 bg-surface-strong rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 text-xs text-muted">
        Restant : {Math.round(remaining)} {unit}
      </div>
    </div>
  );
}
