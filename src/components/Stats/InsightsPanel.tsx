// Indicateurs de la page Tendances : moyennes et régularité sur 7 jours,
// série en cours et dépense énergétique estimée.
import { Activity, CalendarCheck, Droplet, Drumstick, Flame, Repeat } from 'lucide-react';
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
import { formatLiters } from '../../utils/water';
import { formatNumber, formatSigned } from '../../utils/format';

interface InsightsPanelProps {
  days: readonly DayIntake[];
  weights: readonly WeightPoint[];
  today: string;
  /** Dépense estimée par la formule (métabolisme de base × activité), si connue */
  formulaExpenditureKcal?: number | null;
  /** Eau des 7 derniers jours (weeklyWaterSummary), si chargée */
  water?: { averageMl: number | null; daysAtGoal: number };
}


function StatTile({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs text-subtle">{detail}</div>
    </div>
  );
}

export function InsightsPanel({ days, weights, today, formulaExpenditureKcal = null, water }: InsightsPanelProps) {
  const week = computeWeekInsights(days, today);
  const streak = computeLoggingStreak(days, today);
  const expenditure = estimateExpenditure(days, weights, today);
  const iconClass = 'h-4 w-4 text-subtle';

  const caloriesDetail =
    week.avgCalories === null
      ? 'Aucune journée renseignée'
      : week.avgTargetCalories === null
        ? 'Pas d’objectif sur la période'
        : `Objectif ${formatNumber(week.avgTargetCalories)} kcal · écart ${formatSigned(week.avgCalories - week.avgTargetCalories)}`;

  return (
    <section aria-labelledby="insights-title" className="space-y-3">
      <div>
        <h3 id="insights-title" className="section-label">
          Vos {week.periodDays} derniers jours
        </h3>
        <p className="text-xs text-subtle">Jours complets renseignés, aujourd’hui exclu.</p>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${water ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
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
        {water && (
          <StatTile
            icon={<Droplet className="h-4 w-4 text-info-600" aria-hidden="true" />}
            label="Eau moyenne"
            value={water.averageMl === null ? '—' : `${formatLiters(water.averageMl).replace(' L', ' L/j')}`}
            detail={water.averageMl === null ? 'Aucune prise notée' : `${water.daysAtGoal}/${week.periodDays} jours à l’objectif`}
          />
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface-muted p-3 sm:p-4" data-testid="expenditure">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <Activity className={iconClass} aria-hidden="true" />
          Dépense énergétique estimée ({EXPENDITURE_WINDOW_DAYS} derniers jours)
        </div>

        {expenditure.status === 'ok' ? (
          <>
            <div className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
              ≈ {formatNumber(expenditure.expenditureKcal)} kcal/j
            </div>
            <p className="mt-1 text-xs text-muted">
              Apport moyen {formatNumber(expenditure.avgIntakeKcal)} kcal/j sur {expenditure.loggedDays} jours
              renseignés, poids {formatSigned(expenditure.weeklyWeightChangeKg, 2)} kg/semaine
              {formulaExpenditureKcal ? ` · formule : ${formatNumber(formulaExpenditureKcal)} kcal/j` : ''}.
            </p>
            <p className="mt-1 text-xs text-subtle">
              Fiable si vos journées sont saisies en entier. Quand l’écart avec votre objectif dépasse 100 kcal/j,
              un ajustement des calories vous est proposé ci-dessous.
            </p>
          </>
        ) : expenditure.status === 'unreliable' ? (
          <p className="mt-1 text-sm text-muted">
            Estimation impossible : les apports saisis ne collent pas avec l’évolution de votre poids (journées
            probablement incomplètes). Saisissez vos repas en entier pour l’obtenir.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">
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
