// Indicateurs de la page Tendances : moyennes et régularité sur 7 jours,
// série en cours et dépense énergétique estimée.
import { Activity, CalendarCheck, Drumstick, Flame, Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  computeLoggingStreak,
  computeWeekInsights,
  DayIntake,
  estimateExpenditure,
  EXPENDITURE_MIN_LOGGED_DAYS,
  EXPENDITURE_MIN_WEIGH_INS,
  EXPENDITURE_WINDOW_DAYS,
} from '../../utils/insights';
import type { WeightPoint } from '../../utils/weights';

interface InsightsPanelProps {
  days: readonly DayIntake[];
  weights: readonly WeightPoint[];
  today: string;
  /** Dépense estimée par la formule (métabolisme de base × activité), si connue */
  formulaExpenditureKcal?: number | null;
}

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatSigned = (value: number, digits = 0) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`;

function StatTile({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-gray-900 sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

export function InsightsPanel({ days, weights, today, formulaExpenditureKcal = null }: InsightsPanelProps) {
  const week = computeWeekInsights(days, today);
  const streak = computeLoggingStreak(days, today);
  const expenditure = estimateExpenditure(days, weights, today);
  const iconClass = 'h-4 w-4 text-gray-400';

  const caloriesDetail =
    week.avgCalories === null
      ? 'Aucune journée renseignée'
      : week.avgTargetCalories === null
        ? 'Pas d’objectif sur la période'
        : `Objectif ${formatNumber(week.avgTargetCalories)} kcal · écart ${formatSigned(week.avgCalories - week.avgTargetCalories)}`;

  return (
    <section aria-labelledby="insights-title" className="space-y-3">
      <div>
        <h3 id="insights-title" className="text-sm text-gray-900">
          Vos {week.periodDays} derniers jours
        </h3>
        <p className="text-xs text-gray-500">Jours complets renseignés, aujourd’hui exclu.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Flame className={iconClass} aria-hidden="true" />}
          label="Calories moyennes"
          value={week.avgCalories === null ? '—' : `${formatNumber(week.avgCalories)} kcal/j`}
          detail={caloriesDetail}
        />
        <StatTile
          icon={<Drumstick className={iconClass} aria-hidden="true" />}
          label="Protéines moyennes"
          value={week.avgProteinG === null ? '—' : `${formatNumber(week.avgProteinG)} g/j`}
          detail={
            week.avgTargetProteinG === null
              ? 'Pas d’objectif sur la période'
              : `Objectif ${formatNumber(week.avgTargetProteinG)} g/j`
          }
        />
        <StatTile
          icon={<CalendarCheck className={iconClass} aria-hidden="true" />}
          label="Régularité"
          value={`${week.loggedDays}/${week.periodDays} jours`}
          detail={`${week.onTargetDays} jour${week.onTargetDays > 1 ? 's' : ''} à l’objectif`}
        />
        <StatTile
          icon={<Repeat className={iconClass} aria-hidden="true" />}
          label="Série en cours"
          value={`${streak} jour${streak > 1 ? 's' : ''}`}
          detail={streak > 0 ? 'renseignés d’affilée' : 'Saisissez un repas pour la lancer'}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4" data-testid="expenditure">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <Activity className={iconClass} aria-hidden="true" />
          Dépense énergétique estimée ({EXPENDITURE_WINDOW_DAYS} derniers jours)
        </div>

        {expenditure.status === 'ok' ? (
          <>
            <div className="mt-1 text-xl font-semibold text-gray-900 sm:text-2xl">
              ≈ {formatNumber(expenditure.expenditureKcal)} kcal/j
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Apport moyen {formatNumber(expenditure.avgIntakeKcal)} kcal/j sur {expenditure.loggedDays} jours
              renseignés, poids {formatSigned(expenditure.weeklyWeightChangeKg, 2)} kg/semaine
              {formulaExpenditureKcal ? ` · formule : ${formatNumber(formulaExpenditureKcal)} kcal/j` : ''}.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Fiable si vos journées sont saisies en entier. Quand l’écart avec votre objectif dépasse 100 kcal/j,
              un ajustement des calories vous est proposé ci-dessous.
            </p>
          </>
        ) : expenditure.status === 'unreliable' ? (
          <p className="mt-1 text-sm text-gray-600">
            Estimation impossible : les apports saisis ne collent pas avec l’évolution de votre poids (journées
            probablement incomplètes). Saisissez vos repas en entier pour l’obtenir.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            Disponible après {EXPENDITURE_MIN_LOGGED_DAYS} jours renseignés et {EXPENDITURE_MIN_WEIGH_INS} pesées
            réparties sur 2 semaines. Actuellement : {expenditure.loggedDays} jour
            {expenditure.loggedDays > 1 ? 's' : ''} renseigné{expenditure.loggedDays > 1 ? 's' : ''},{' '}
            {expenditure.weighIns} pesée{expenditure.weighIns > 1 ? 's' : ''}.
          </p>
        )}
      </div>
    </section>
  );
}
