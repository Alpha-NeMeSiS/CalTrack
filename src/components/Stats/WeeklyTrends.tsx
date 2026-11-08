// Tendances : indicateurs (moyennes, régularité, dépense estimée), graphique des
// calories sur 7 jours, courbe de poids et historique détaillé sur 30 jours
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, Goal, WeightLog } from '../../lib/supabase';
import { fetchActiveGoal } from '../../services/goals';
import { fetchWeightLogs } from '../../services/weights';
import { WeightChart } from './WeightChart';
import { BodyCompositionChart } from './BodyCompositionChart';
import { InsightsPanel } from './InsightsPanel';
import { CalorieAdjustmentCard } from './CalorieAdjustmentCard';
import { useAuth } from '../../contexts/useAuth';
import { calculateBMR, calculateDailySummary, calculateTDEE } from '../../utils/calculations';
import { chooseBmrMethod } from '../../utils/goals';
import { DayIntake, estimateExpenditure } from '../../utils/insights';
import { CalorieAdjustmentSuggestion, suggestCalorieAdjustment } from '../../utils/calorieAdjustment';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../utils/date';
import {
  DayStatus,
  DAY_STATUS_LABELS,
  getBarColorClass,
  getCalorieAxisTicks,
  getDayStatus,
} from '../../utils/dayStatus';

// Interface pour le résumé des macronutriments
interface MacroSummary {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
}

// Interface pour le résumé quotidien
interface DailySummary {
  date: string;
  consumed: MacroSummary; // Macronutriments consommés
  target: MacroSummary; // Objectifs de macronutriments
  status: 'under' | 'ok' | 'over'; // Statut par rapport à l'objectif
}

// Données d'une journée
type DayItem = {
  date: string;
  summary: DailySummary | null; // null si aucun objectif ce jour-là
  dayStatus: DayStatus | null; // statut d'affichage (null si aucun objectif)
  intake: DayIntake; // apports du jour (même sans objectif) pour les indicateurs
};

// Hauteur utilisable du graphique (barres, graduations et grille partagent cette échelle)
const CHART_HEIGHT_PX = 200;

// Styles des lignes de l'historique selon le statut
const ROW_STYLES: Record<DayStatus, { bg: string; text: string }> = {
  not_logged: { bg: 'bg-surface-muted', text: 'text-subtle' },
  in_progress: { bg: 'bg-info-50', text: 'text-info-700' },
  under: { bg: 'bg-orange-50', text: 'text-orange-700' },
  ok: { bg: 'bg-success-50', text: 'text-success-700' },
  over: { bg: 'bg-danger-50', text: 'text-danger-700' },
};

// Légende du graphique
const LEGEND: Array<{ label: string; swatch: string }> = [
  { label: DAY_STATUS_LABELS.ok, swatch: 'bg-success-500' },
  { label: DAY_STATUS_LABELS.under, swatch: 'bg-orange-400' },
  { label: DAY_STATUS_LABELS.over, swatch: 'bg-danger-500' },
  { label: DAY_STATUS_LABELS.in_progress, swatch: 'bg-info-400' },
  { label: DAY_STATUS_LABELS.not_logged, swatch: 'bg-surface-strong' },
];

// Composant principal pour afficher les tendances hebdomadaires
export function WeeklyTrends() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<DayItem[]>([]); // 7 derniers jours
  const [monthData, setMonthData] = useState<DayItem[]>([]); // 30 derniers jours
  const [weights, setWeights] = useState<WeightLog[]>([]); // 90 derniers jours
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);

  // Dépense « théorique » (formule) pour la comparer à la dépense estimée
  // Suggestion appliquée : gardée affichée (message de confirmation) après la
  // mise à jour de l'objectif, qui ne propose plus rien pendant une semaine
  const [appliedSuggestion, setAppliedSuggestion] = useState<CalorieAdjustmentSuggestion | null>(null);

  const formulaExpenditure = useMemo(
    () =>
      activeGoal && profile
        ? Math.round(calculateTDEE(calculateBMR(profile, chooseBmrMethod(profile)), Number(activeGoal.activity_level)))
        : null,
    [activeGoal, profile]
  );
  const targetWeight =
    activeGoal && activeGoal.type !== 'maintain' ? Number(activeGoal.target_weight_kg) || null : null;

  // Charge les cibles et les entrées des 30 derniers jours
  const loadWeekData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setLoadError(null);
    try {
      // Dates locales (et non UTC) pour la période d'analyse
      const endDate = getTodayDate();
      const startDate = addDaysToDateString(endDate, -30);

      const [targetsResult, entriesResult] = await Promise.all([
        supabase
          .from('daily_targets')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
        supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
      ]);

      if (targetsResult.error) throw targetsResult.error;
      if (entriesResult.error) throw entriesResult.error;

      const targets = targetsResult.data || [];
      const entries = entriesResult.data || [];

      const buildDay = (dateStr: string): DayItem => {
        const dayTarget = targets.find((t) => t.date === dateStr);
        const dayEntries = entries.filter((e) => e.date === dateStr);
        const intake: DayIntake = {
          date: dateStr,
          entryCount: dayEntries.length,
          consumedKcal: dayEntries.reduce((sum, e) => sum + (Number(e.kcal) || 0), 0),
          consumedProteinG: dayEntries.reduce((sum, e) => sum + (Number(e.protein_g) || 0), 0),
          targetKcal: dayTarget ? Number(dayTarget.calories_kcal) : null,
          targetProteinG: dayTarget ? Number(dayTarget.protein_g) : null,
          status: null,
        };
        if (!dayTarget) {
          return { date: dateStr, summary: null, dayStatus: null, intake };
        }
        const summary = calculateDailySummary(dayEntries, dayTarget, dateStr);
        const dayStatus = getDayStatus({
          status: summary.status,
          entryCount: dayEntries.length,
          isToday: dateStr === endDate,
        });
        return { date: dateStr, summary, dayStatus, intake: { ...intake, status: dayStatus } };
      };

      // 7 derniers jours (du plus ancien au plus récent) et 30 derniers (du plus récent)
      setWeekData([6, 5, 4, 3, 2, 1, 0].map((i) => buildDay(addDaysToDateString(endDate, -i))));
      setMonthData(Array.from({ length: 30 }, (_, i) => buildDay(addDaysToDateString(endDate, -i))));

      // Courbe de poids : non bloquante (les calories restent affichées si elle échoue)
      try {
        const [weightLogs, goal] = await Promise.all([
          fetchWeightLogs(user.id, addDaysToDateString(endDate, -90)),
          fetchActiveGoal(user.id),
        ]);
        setWeights(weightLogs);
        setActiveGoal(goal);
      } catch (weightError) {
        console.error('Error loading weight logs:', weightError);
        setWeights([]);
      }
    } catch (error) {
      console.error('Error loading week data:', error);
      setLoadError("Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [loadWeekData, user]);

  if (loading) {
    return (
      <div className="panel p-6">
        <h2 className="text-xl text-ink mb-4">Tendances 7 jours</h2>
        <div className="text-center py-8 text-subtle">Chargement...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="panel p-6">
        <h2 className="text-xl text-ink mb-4">Tendances et historique</h2>
        <div role="alert" className="text-center py-8">
          <p className="text-danger-700 mb-4">{loadError}</p>
          <button type="button" onClick={() => loadWeekData()} className="btn-brand">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Échelle du graphique : les journées non renseignées ne comptent pas
  const maxCalories = Math.max(
    0,
    ...weekData
      .filter((d) => d.summary)
      .map((d) => Math.max(d.summary!.consumed.calories_kcal, d.summary!.target.calories_kcal))
  );
  const ticks = getCalorieAxisTicks(maxCalories);
  const axisMax = ticks[ticks.length - 1];
  const toPx = (value: number) => Math.round((Math.max(0, value) / axisMax) * CHART_HEIGHT_PX);

  // Ajustement des calories proposé d'après la dépense réelle
  const suggestion =
    activeGoal && profile
      ? suggestCalorieAdjustment({
          profile,
          goal: activeGoal,
          expenditure: estimateExpenditure(monthData.map((day) => day.intake), weights, getTodayDate()),
        })
      : null;
  const shownSuggestion = appliedSuggestion ?? suggestion;

  return (
    <div className="panel">
      <div className="p-4 sm:p-6 border-b border-line">
        <h2 className="text-xl text-ink">Tendances et historique</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <InsightsPanel
          days={monthData.map((day) => day.intake)}
          weights={weights}
          today={getTodayDate()}
          formulaExpenditureKcal={formulaExpenditure}
        />

        {shownSuggestion && activeGoal && profile && user && (
          <CalorieAdjustmentCard
            userId={user.id}
            profile={profile}
            goal={activeGoal}
            suggestion={shownSuggestion}
            today={getTodayDate()}
            onApplied={(updated) => {
              setAppliedSuggestion(shownSuggestion);
              setActiveGoal(updated);
            }}
          />
        )}

        <div>
          <h3 className="text-sm text-ink mb-4">Graphique des calories</h3>
          <div className="bg-surface-muted p-3 sm:p-4 rounded-lg">
            <div className="flex gap-2" role="img" aria-label="Calories consommées et objectif sur les 7 derniers jours">
              {/* Axe Y : graduations positionnées sur la même échelle que les barres */}
              <div className="relative w-10 shrink-0" style={{ height: CHART_HEIGHT_PX }} aria-hidden="true">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute right-0 translate-y-1/2 text-[11px] leading-none text-subtle"
                    style={{ bottom: toPx(tick) }}
                  >
                    {tick}
                  </span>
                ))}
              </div>

              {/* Zone des barres avec lignes de grille */}
              <div className="relative flex-1" style={{ height: CHART_HEIGHT_PX }}>
                {ticks.map((tick) => (
                  <div
                    key={tick}
                    className="absolute inset-x-0 border-t border-line"
                    style={{ bottom: toPx(tick) }}
                    aria-hidden="true"
                  />
                ))}

                <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
                  {weekData.map((day) => {
                    const consumed = day.summary?.consumed.calories_kcal ?? 0;
                    const target = day.summary?.target.calories_kcal ?? 0;
                    const status = day.dayStatus;
                    const hasBar = day.summary && status !== 'not_logged';
                    const label = status ? DAY_STATUS_LABELS[status] : 'Pas d’objectif';
                    const tooltip = day.summary
                      ? `${label} — ${Math.round(consumed)} / ${Math.round(target)} kcal`
                      : label;

                    return (
                      <div key={day.date} className="relative flex h-full flex-1 items-end justify-center group" title={tooltip}>
                        {day.summary && (
                          <div
                            className="absolute inset-x-0 border-t-2 border-dashed border-info-400"
                            style={{ bottom: toPx(target) }}
                            aria-hidden="true"
                          />
                        )}
                        {hasBar ? (
                          <div
                            className={`relative w-full rounded-t transition-all duration-300 ${getBarColorClass(status!, consumed, target)}`}
                            style={{ height: Math.max(4, toPx(consumed)) }}
                          />
                        ) : (
                          // Journée non renseignée (ou sans objectif) : simple repère gris
                          <div className="w-full h-1 rounded-t bg-surface-strong" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Jours de la semaine, alignés sur les barres */}
            <div className="flex gap-1.5 sm:gap-2 mt-1 pl-12">
              {weekData.map((day) => (
                <div key={day.date} className="flex-1 text-center text-xs text-muted font-medium capitalize">
                  {parseLocalDate(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-xs">
              {LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${item.swatch}`} />
                  <span className="text-muted">{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-6 border-t-2 border-dashed border-info-400" />
                <span className="text-muted">Objectif</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-ink mb-3">Évolution du poids (90 jours)</h3>
          <WeightChart points={weights} targetWeight={targetWeight} />
        </div>

        <div>
          <h3 className="text-sm text-ink mb-3">Composition corporelle (90 jours)</h3>
          <BodyCompositionChart logs={weights} />
        </div>

        <div>
          <h3 id="daily-history-title" className="text-sm text-ink mb-3">Historique détaillé (30 jours)</h3>
          {/* Zone défilante atteignable au clavier (flèches) et nommée pour les lecteurs d'écran */}
          <div
            role="region"
            aria-labelledby="daily-history-title"
            tabIndex={0}
            className="space-y-2 h-[400px] overflow-y-auto pr-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {monthData.map((day) => {
              const date = parseLocalDate(day.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

              if (!day.summary || !day.dayStatus) {
                return (
                  <div key={day.date} className="flex items-center justify-between p-3 bg-surface-muted rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-muted capitalize">{dayName}</div>
                      <div className="text-xs text-subtle">{dateStr}</div>
                    </div>
                    <div className="text-sm text-subtle">Pas d’objectif</div>
                  </div>
                );
              }

              const style = ROW_STYLES[day.dayStatus];
              const statusLabel = DAY_STATUS_LABELS[day.dayStatus];

              if (day.dayStatus === 'not_logged') {
                return (
                  <div key={day.date} className={`flex items-center justify-between p-3 ${style.bg} rounded-md`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-muted capitalize">{dayName}</div>
                      <div className="text-xs text-subtle">{dateStr}</div>
                    </div>
                    <div className={`text-sm ${style.text}`}>
                      {statusLabel}
                      <span className="text-subtle"> · objectif {Math.round(day.summary.target.calories_kcal)} kcal</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={day.date} className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 p-3 ${style.bg} rounded-md`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium text-ink capitalize">{dayName}</div>
                    <div className="text-xs text-muted">{dateStr}</div>
                  </div>

                  <div className="flex items-start justify-between gap-3 sm:justify-end sm:gap-4">
                    <div className="text-sm text-body">
                      <div className="flex items-baseline gap-1">
                        <span className="font-semibold">{Math.round(day.summary.consumed.calories_kcal)}</span>
                        <span className="text-subtle"> / {Math.round(day.summary.target.calories_kcal)} kcal</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-subtle mt-1">
                        <div>P: <span className="font-semibold">{Math.round(day.summary.consumed.protein_g)} g</span> / {Math.round(day.summary.target.protein_g)} g</div>
                        <div>L: <span className="font-semibold">{Math.round(day.summary.consumed.fat_g)} g</span> / {Math.round(day.summary.target.fat_g)} g</div>
                        <div>G: <span className="font-semibold">{Math.round(day.summary.consumed.carbs_g)} g</span> / {Math.round(day.summary.target.carbs_g)} g</div>
                        <div>F: <span className="font-semibold">{Math.round(day.summary.consumed.fiber_g || 0)} g</span> / {Math.round(day.summary.target.fiber_g || 0)} g</div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${style.text}`}>
                      {statusLabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
