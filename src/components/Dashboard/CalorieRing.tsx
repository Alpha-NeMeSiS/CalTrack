interface CalorieRingProps {
  consumed: number;
  target: number;
  status: 'under' | 'ok' | 'over';
}

export function CalorieRing({ consumed, target, status }: CalorieRingProps) {
  const percentage = Math.min((consumed / target) * 100, 100);
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const statusConfig = {
    under: { color: 'text-orange-600', bg: 'bg-orange-100', stroke: '#ea580c', label: 'Sous l\'objectif' },
    ok: { color: 'text-green-600', bg: 'bg-green-100', stroke: '#16a34a', label: 'Objectif atteint' },
    over: { color: 'text-red-600', bg: 'bg-red-100', stroke: '#dc2626', label: 'Au-dessus' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="70"
            stroke="#e5e7eb"
            strokeWidth="12"
            fill="none"
          />
          <circle
            cx="96"
            cy="96"
            r="70"
            stroke={config.stroke}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-gray-900">{Math.round(consumed)}</div>
          <div className="text-sm text-gray-500">/ {Math.round(target)}</div>
          <div className="text-xs text-gray-400 mt-1">kcal</div>
        </div>
      </div>

      <div className={`mt-4 px-4 py-2 rounded-full ${config.bg} ${config.color} text-sm font-medium`}>
        {config.label}
      </div>

      <div className="mt-2 text-sm text-gray-600">
        {status === 'under' && `Encore ${Math.round(target - consumed)} kcal`}
        {status === 'ok' && 'Parfait !'}
        {status === 'over' && `+${Math.round(consumed - target)} kcal`}
      </div>
    </div>
  );
}
