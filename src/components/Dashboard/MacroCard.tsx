interface MacroCardProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: string;
}

export function MacroCard({ label, consumed, target, unit, color }: MacroCardProps) {
  const percentage = Math.min((consumed / target) * 100, 100);
  const remaining = Math.max(target - consumed, 0);

  return (
    <div className="bg-white p-4 rounded-lg border border-kaizen-1000">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>

      <div className="mb-2">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{Math.round(consumed)}</span>
          <span className="text-sm text-gray-500">/ {Math.round(target)}</span>
        </div>
      </div>

      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 text-xs text-gray-600">
        Restant : {Math.round(remaining)} {unit}
      </div>
    </div>
  );
}
