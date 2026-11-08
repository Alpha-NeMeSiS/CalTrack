// Courbe de poids (SVG, sans dépendance) : pesées, moyenne glissante sur 7 jours
// et ligne du poids cible.
import { parseLocalDate } from '../../utils/date';
import { movingAverage, sortWeights, WeightPoint } from '../../utils/weights';

interface WeightChartProps {
  points: readonly WeightPoint[];
  targetWeight?: number | null;
}

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const DAY_MS = 24 * 60 * 60 * 1000;

const formatKg = (value: number) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function WeightChart({ points, targetWeight }: WeightChartProps) {
  const sorted = sortWeights(points);

  if (sorted.length < 2) {
    return (
      <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
        Enregistrez au moins deux pesées (depuis le tableau de bord) pour voir la courbe de votre poids.
      </p>
    );
  }

  const average = movingAverage(sorted, 7);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Échelles
  const firstTime = parseLocalDate(first.date).getTime();
  const spanDays = Math.max(1, (parseLocalDate(last.date).getTime() - firstTime) / DAY_MS);
  const values = sorted.map((p) => p.weight_kg);
  const showTarget = targetWeight != null && targetWeight > 0;
  let minY = Math.min(...values, ...(showTarget ? [targetWeight] : []));
  let maxY = Math.max(...values, ...(showTarget ? [targetWeight] : []));
  if (maxY - minY < 2) {
    const mid = (maxY + minY) / 2;
    minY = mid - 1;
    maxY = mid + 1;
  }
  minY = Math.floor(minY - 0.5);
  maxY = Math.ceil(maxY + 0.5);

  const x = (date: string) =>
    PAD.left + ((parseLocalDate(date).getTime() - firstTime) / DAY_MS / spanDays) * (WIDTH - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + ((maxY - kg) / (maxY - minY)) * (HEIGHT - PAD.top - PAD.bottom);
  const yTicks = [maxY, (maxY + minY) / 2, minY];

  const averagePath = average.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.weight_kg).toFixed(1)}`).join(' ');
  const change = Math.round((last.weight_kg - first.weight_kg) * 10) / 10;

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Poids passé de ${formatKg(first.weight_kg)} kg le ${formatDate(first.date)} à ${formatKg(last.weight_kg)} kg le ${formatDate(last.date)}`}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" />
            <text x={PAD.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6b7280">
              {formatKg(tick)}
            </text>
          </g>
        ))}

        {showTarget && (
          <g>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(targetWeight)}
              y2={y(targetWeight)}
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <text x={WIDTH - PAD.right} y={y(targetWeight) - 6} textAnchor="end" fontSize="11" fill="#2563eb">
              Cible {formatKg(targetWeight)} kg
            </text>
          </g>
        )}

        <path d={averagePath} fill="none" stroke="#19b887" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.weight_kg)} r="3.5" fill="#ffffff" stroke="#106a53" strokeWidth="1.5">
            <title>{`${formatDate(p.date)} : ${formatKg(p.weight_kg)} kg`}</title>
          </circle>
        ))}

        <text x={PAD.left} y={HEIGHT - 6} fontSize="11" fill="#6b7280">{formatDate(first.date)}</text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize="11" fill="#6b7280">{formatDate(last.date)}</text>
      </svg>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-kaizen-500" /> Moyenne 7 jours</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-kaizen-700 bg-white" /> Pesées</span>
        {showTarget && <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-blue-400" /> Poids cible</span>}
        <span className="ml-auto font-medium text-gray-800" data-testid="weight-change">
          {change > 0 ? '+' : ''}{formatKg(change)} kg depuis le {formatDate(first.date)}
        </span>
      </figcaption>
    </figure>
  );
}
