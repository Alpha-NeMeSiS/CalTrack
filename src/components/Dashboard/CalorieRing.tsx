import type { CalorieDisplay } from '../../utils/preferences';

interface CalorieRingProps {
  consumed: number;
  target: number;
  status: 'under' | 'ok' | 'over';
  /**
   * Journée en cours : être « sous l'objectif » n'est pas un échec (la journée
   * n'est pas finie). On affiche alors un statut neutre « En cours ».
   */
  inProgress?: boolean;
  /** « consumed » : consommées / objectif ; « remaining » : calories restantes en avant */
  display?: CalorieDisplay;
}

export function CalorieRing({ consumed, target, status, inProgress = false, display = 'consumed' }: CalorieRingProps) {
  // Garde-fou : un objectif à 0 donnerait NaN / Infinity
  const percentage = target > 0 ? Math.min(Math.max((consumed / target) * 100, 0), 100) : 0;
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const statusConfig = {
    under: { color: 'text-orange-700', bg: 'bg-orange-100', stroke: 'stroke-orange-600', label: 'Sous l\'objectif' },
    ok: { color: 'text-success-700', bg: 'bg-success-100', stroke: 'stroke-success-600', label: 'Objectif atteint' },
    over: { color: 'text-danger-700', bg: 'bg-danger-100', stroke: 'stroke-danger-600', label: 'Au-dessus' },
  };
  // Journée en cours : vert de la marque (jauge principale), pas un jugement
  const inProgressConfig = { color: 'text-brand-700', bg: 'bg-brand-50', stroke: 'stroke-brand-600', label: 'En cours' };

  const config = inProgress && status === 'under' ? inProgressConfig : statusConfig[status];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="70"
            className="stroke-line"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="96"
            cy="96"
            r="70"
            className={`${config.stroke} transition-all duration-500`}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {display === 'remaining' ? (
            <>
              <div className="text-3xl font-bold text-ink">{Math.round(Math.abs(target - consumed))}</div>
              <div className="text-xs text-subtle mt-1">{consumed > target ? 'kcal en trop' : 'kcal restantes'}</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-ink">{Math.round(consumed)}</div>
              <div className="text-sm text-subtle">/ {Math.round(target)}</div>
              <div className="text-xs text-subtle mt-1">kcal</div>
            </>
          )}
        </div>
      </div>

      <div className={`mt-4 px-4 py-2 rounded-full ${config.bg} ${config.color} text-sm font-medium`}>
        {config.label}
      </div>

      <div className="mt-2 text-sm text-muted">
        {display === 'remaining' ? (
          `${Math.round(consumed)} / ${Math.round(target)} kcal consommées`
        ) : (
          <>
            {status === 'under' && `Encore ${Math.round(target - consumed)} kcal`}
            {status === 'ok' && 'Parfait !'}
            {status === 'over' && `+${Math.round(consumed - target)} kcal`}
          </>
        )}
      </div>
    </div>
  );
}
