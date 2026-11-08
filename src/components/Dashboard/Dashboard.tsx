// Tableau de bord principal
// Affiche l'anneau calorique, les macrocarts, le journal du jour et gère la création/suppression d'entrées
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { supabase, DailyTarget, Entry, Goal, BodyComposition } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { calculateDailySummary } from '../../utils/calculations';
import { addDaysToDateString, getTodayDate, isDateOnlyString, parseLocalDate } from '../../utils/date';
import { findGoalForDate, isGoalEndedOn } from '../../utils/goals';
import { navigateTo } from '../../utils/navigation';
import { formatDateFR } from '../../lib/timeProgress';
import { ensureDailyTargetForDate, fetchUserGoals } from '../../services/goals';
import { recordWeight } from '../../services/weights';
import { copyDayEntries, updateEntry } from '../../services/entries';
import { groupEntriesByMeal, MealType } from '../../utils/entries';
import { usePreferences } from '../../contexts/usePreferences';
import { getMealLabel, getVisibleMeals } from '../../utils/preferences';
import { WeightQuickLog } from '../Weight/WeightQuickLog';
import { CalorieRing } from './CalorieRing';
import { MacroCard } from './MacroCard';
import { WaterCard } from '../Water/WaterCard';
import { waterGoal } from '../../utils/water';
import { GoalProgressCard } from './GoalProgressCard';
import { AddEntryModal } from '../Journal/AddEntryModal';

interface DashboardProps {
  activeDate?: string;
  onActiveDateChange?: (date: string) => void;
}

type AddEntryData = Omit<Entry, 'id' | 'user_id' | 'date' | 'created_at'>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Dashboard({
  activeDate,
  onActiveDateChange,
}: DashboardProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { preferences } = usePreferences();
  const [selectedDate, setSelectedDate] = useState(activeDate ?? getTodayDate());
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [goalForDate, setGoalForDate] = useState<Goal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Journal : modification d'une entrée et copie de la veille
  const [editing, setEditing] = useState<{ id: string; quantity: string; meal: MealType | '' } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [copying, setCopying] = useState(false);
  const [journalMessage, setJournalMessage] = useState<string | null>(null);
  // Identifiant de la dernière requête : ignore les réponses d'une date
  // précédente qui arriveraient après celles de la date courante.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (activeDate && activeDate !== selectedDate) {
      setSelectedDate(activeDate);
    }
  }, [activeDate, selectedDate]);

  // Charge les données du jour : entrées, objectifs et cible.
  // silent = true : actualisation en arrière-plan (après un ajout ou une
  // suppression) sans remplacer la page par l'écran de chargement.
  const loadDayData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user || !profile) return;

      const requestId = ++requestIdRef.current;
      if (!silent) {
        setLoading(true);
      }
      setLoadError(null);

      try {
        const [entriesResult, goals] = await Promise.all([
          supabase
            .from('entries')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', selectedDate)
            .order('created_at', { ascending: true }),
          fetchUserGoals(user.id),
        ]);

        if (entriesResult.error) throw entriesResult.error;

        // Objectif actif (progression) et objectif en vigueur à la date affichée
        const currentGoal = goals.find((goal) => goal.is_active) ?? null;
        const dateGoal = findGoalForDate(goals, selectedDate);

        // Récupère la cible du jour, ou la calcule depuis l'objectif en vigueur
        const dayTarget = await ensureDailyTargetForDate(user.id, selectedDate, profile, dateGoal);

        if (requestId !== requestIdRef.current) return; // réponse périmée
        setTarget(dayTarget);
        setEntries((entriesResult.data as Entry[]) || []);
        setActiveGoal(currentGoal);
        setGoalForDate(dateGoal);
      } catch (error) {
        console.error('Error loading day data:', error);
        if (requestId !== requestIdRef.current) return;
        setLoadError('Impossible de charger les données de cette journée.');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [selectedDate, user, profile]
  );

  // Changement de date ou d'utilisateur : écran de chargement. Simple mise à
  // jour du profil (ex : nouvelle pesée) : actualisation en arrière-plan.
  const lastLoadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${user?.id ?? ''}|${selectedDate}`;
    const silent = lastLoadKeyRef.current === key;
    lastLoadKeyRef.current = key;
    loadDayData({ silent });
  }, [loadDayData, user?.id, selectedDate]);

  // Enregistre une pesée ; si c'est la plus récente, le poids du profil et la
  // cible du jour sont mis à jour.
  const handleSaveWeight = async (weightKg: number, date: string, composition?: BodyComposition) => {
    if (!user || !profile) return;
    const profileUpdated = await recordWeight({
      userId: user.id,
      date,
      weightKg,
      composition,
      profile,
      goalForToday: activeGoal,
      today: getTodayDate(),
    });
    if (profileUpdated) {
      await refreshProfile();
    }
  };

  // Ajoute une entrée dans la table 'entries' puis recharge les données
  const handleAddEntry = async (entryData: AddEntryData): Promise<boolean> => {
    if (!user) return false;

    try {
      const cleanedEntry = { ...entryData };
      // food_id référence la table foods (uuid) : les identifiants Ciqual/OFF n'en sont pas
      if (cleanedEntry.food_id !== undefined && !UUID_PATTERN.test(String(cleanedEntry.food_id))) {
        delete cleanedEntry.food_id;
      }

      const { error } = await supabase.from('entries').insert({
        user_id: user.id,
        date: selectedDate,
        ...cleanedEntry,
      });

      if (error) throw error;

      await loadDayData({ silent: true });
      return true;
    } catch (error) {
      console.error('Error adding entry:', error);
      return false;
    }
  };

  // Supprime une entrée puis recharge les données
  const handleDeleteEntry = async (entryId: string, label?: string) => {
    const confirmed = window.confirm(
      label ? `Supprimer « ${label} » du journal ?` : 'Supprimer cet aliment du journal ?'
    );
    if (!confirmed) return false;

    setActionError(null);
    try {
      const { error } = await supabase.from('entries').delete().eq('id', entryId);

      if (error) throw error;

      await loadDayData({ silent: true });
      return true;
    } catch (error) {
      console.error('Error deleting entry:', error);
      setActionError("La suppression a échoué. Réessayez.");
      return false;
    }
  };

  const startEditing = (entry: Entry) => {
    setEditError(null);
    setEditing({ id: entry.id, quantity: String(entry.qty_grammes), meal: entry.meal_type ?? '' });
  };

  // Modifie quantité et repas (nutriments recalculés proportionnellement)
  const handleUpdateEntry = async (entry: Entry) => {
    if (!editing) return;
    const quantity = Number(editing.quantity.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
      setEditError('La quantité doit être un nombre de grammes supérieur à 0.');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateEntry(entry, quantity, editing.meal || null);
      setEditing(null);
      await loadDayData({ silent: true });
    } catch (error) {
      console.error('Error updating entry:', error);
      setEditError("La modification a échoué. Réessayez.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Copie tous les aliments de la veille vers la journée affichée
  const handleCopyPreviousDay = async () => {
    if (!user) return;
    setCopying(true);
    setJournalMessage(null);
    setActionError(null);
    try {
      const count = await copyDayEntries(user.id, addDaysToDateString(selectedDate, -1), selectedDate);
      setJournalMessage(
        count === 0
          ? 'Aucun aliment enregistré la veille.'
          : `${count} aliment${count > 1 ? 's' : ''} copié${count > 1 ? 's' : ''} depuis la veille.`
      );
      if (count > 0) await loadDayData({ silent: true });
    } catch (error) {
      console.error('Error copying entries:', error);
      setActionError('La copie a échoué. Réessayez.');
    } finally {
      setCopying(false);
    }
  };

  const handleDateChange = (nextDate: string) => {
    // Champ vidé ou date incomplète : on garde la date courante
    if (!isDateOnlyString(nextDate)) return;
    setActionError(null);
    setJournalMessage(null);
    setEditing(null);
    setSelectedDate(nextDate);
    onActiveDateChange?.(nextDate);
  };

  // Ouvre l'onglet Objectif
  const openGoalPage = () => navigateTo('goal');

  // En-tête toujours affiché : il permet de changer de date même quand la
  // journée n'a pas d'objectif ou n'a pas pu être chargée.
  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-muted" aria-hidden="true" />
        <input
          type="date"
          aria-label="Date affichée"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          max={getTodayDate()}
          className="px-3 py-2 border border-line-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
      </div>

      {target && !loading && !loadError && (
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="btn-brand hidden sm:flex items-center gap-2"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          Ajouter
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="flex items-center justify-center h-64">
          <div className="text-subtle">Chargement...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-6">
            <p className="text-danger-700 mb-4">{loadError}</p>
            <button onClick={() => loadDayData()} className="btn-brand">
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-6">
            <h3 className="text-lg text-warning-900 mb-2">
              Aucun objectif défini pour cette date
            </h3>
            <p className="text-warning-700 mb-4">
              {goalForDate
                ? "Impossible de calculer la cible de cette journée."
                : 'Vous devez définir un objectif pour commencer le suivi de vos apports.'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => openGoalPage()}
                className="inline-block px-6 py-3 btn-primary font-medium rounded-md"
              >
                Définir un objectif
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = calculateDailySummary(entries, target, selectedDate);
  // La journée en cours n'est pas jugée (« sous l'objectif » à midi n'est pas un échec)
  const isToday = selectedDate === getTodayDate();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {header}

      {actionError && (
        <div role="alert" className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
          {actionError}
        </div>
      )}

      {/* Objectif de perte/prise terminé : suivi automatique en maintien */}
      {goalForDate && goalForDate.type !== 'maintain' && goalForDate.end_date && isGoalEndedOn(goalForDate, selectedDate) && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-800">
            <span className="font-semibold">Objectif terminé le {formatDateFR(parseLocalDate(goalForDate.end_date))}.</span>{' '}
            Vos journées sont maintenant suivies en maintien ({Math.round(target.calories_kcal)} kcal).
          </p>
          <button type="button" onClick={openGoalPage} className="btn-brand whitespace-nowrap text-sm">
            Définir un nouvel objectif
          </button>
        </div>
      )}

      {/* 1. Calories et macros du jour : l'information principale, en premier */}
      <div className="panel p-4">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8 p-2 sm:p-6">
          <div className="flex-shrink-0">
            <CalorieRing
              consumed={summary.consumed.calories_kcal}
              target={summary.target.calories_kcal}
              status={summary.status}
              inProgress={isToday}
              display={preferences.calorieDisplay}
            />
          </div>

          {/* Grille 2×2 sur mobile (auparavant 4 cartes empilées), 4 colonnes au-delà */}
          <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <MacroCard
              label="Protéines"
              consumed={summary.consumed.protein_g}
              target={summary.target.protein_g}
              unit="g"
              color="bg-brand-500"
              display={preferences.macroDisplay}
            />
            <MacroCard
              label="Lipides"
              consumed={summary.consumed.fat_g}
              target={summary.target.fat_g}
              unit="g"
              color="bg-accent-300"
              display={preferences.macroDisplay}
            />
            <MacroCard
              label="Glucides"
              consumed={summary.consumed.carbs_g}
              target={summary.target.carbs_g}
              unit="g"
              color="bg-brand-300"
              display={preferences.macroDisplay}
            />
            <MacroCard
              label="Fibres"
              consumed={summary.consumed.fiber_g}
              target={summary.target.fiber_g ?? 25}
              unit="g"
              color="bg-success-400"
              display={preferences.macroDisplay}
            />
          </div>
        </div>
      </div>

      {/* Eau du jour : objectif manuel (Paramètres) ou automatique d'après le poids */}
      <WaterCard userId={user?.id} date={selectedDate} goalMl={waterGoal(preferences.waterGoalMl, profile?.poids_kg)} />

      {/* 2. Journal du jour, regroupé par repas */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-6 border-b border-surface/20">
          <h2 className="card-title">Journal du jour</h2>
          <button
            type="button"
            onClick={handleCopyPreviousDay}
            disabled={copying}
            className="rounded-md btn-secondary bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {copying ? 'Copie…' : 'Copier les repas de la veille'}
          </button>
        </div>

        {journalMessage && (
          <p role="status" className="px-4 pt-3 text-sm text-brand-700 sm:px-6">{journalMessage}</p>
        )}

        {entries.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <p>Aucun aliment enregistré pour cette journée</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 btn-brand"
            >
              Ajouter votre premier aliment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {groupEntriesByMeal(entries, (meal) => getMealLabel(preferences, meal)).map((group) => (
              <section key={group.meal} aria-label={group.label} className="py-2">
                <div className="flex items-baseline justify-between px-4 pt-2 sm:px-6">
                  <h3 className="section-label">{group.label}</h3>
                  <span className="text-xs text-subtle">{group.kcal} kcal</span>
                </div>

                {group.entries.map((entry) => (
                  <div key={entry.id} className="px-4 py-3 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-medium text-ink">{entry.label || 'Aliment sans nom'}</span>
                        <div className="mt-1 text-sm text-muted">
                          {entry.qty_grammes}g · {Math.round(entry.kcal)} kcal
                        </div>
                        <div className="mt-1 text-xs text-subtle">
                          P: {entry.protein_g}g · L: {entry.fat_g}g · G: {entry.carbs_g}g
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-3 text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => startEditing(entry)}
                          aria-label={`Modifier ${entry.label || 'cet aliment'}`}
                          className="text-muted hover:text-ink"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id, entry.label)}
                          aria-label={`Supprimer ${entry.label || 'cet aliment'}`}
                          className="text-danger-600 hover:text-danger-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {editing?.id === entry.id && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleUpdateEntry(entry);
                        }}
                        aria-label={`Modifier ${entry.label || 'cet aliment'}`}
                        className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-surface-muted p-3"
                      >
                        <div>
                          <label htmlFor={`edit-qty-${entry.id}`} className="mb-1 block text-xs text-muted">Quantité (g)</label>
                          <input
                            id={`edit-qty-${entry.id}`}
                            type="text"
                            inputMode="decimal"
                            value={editing.quantity}
                            onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                            className="w-24 rounded-md border border-line-strong px-2 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor={`edit-meal-${entry.id}`} className="mb-1 block text-xs text-muted">Repas</label>
                          <select
                            id={`edit-meal-${entry.id}`}
                            value={editing.meal}
                            onChange={(e) => setEditing({ ...editing, meal: e.target.value as MealType | '' })}
                            className="rounded-md border border-line-strong px-2 py-1.5"
                          >
                            <option value="">Sans repas</option>
                            {/* Repas visibles, plus celui de l'entrée s'il a été masqué depuis */}
                            {getVisibleMeals(preferences)
                              .concat(editing.meal && !getVisibleMeals(preferences).includes(editing.meal) ? [editing.meal] : [])
                              .map((meal) => (
                                <option key={meal} value={meal}>{getMealLabel(preferences, meal)}</option>
                              ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={savingEdit} className="btn-brand text-sm disabled:opacity-50">
                            {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-sunken">
                            Annuler
                          </button>
                        </div>
                        {editError && <p role="alert" className="w-full text-sm text-danger-700">{editError}</p>}
                      </form>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* 3. Pesée du jour */}
      {user && profile && (
        <WeightQuickLog userId={user.id} date={selectedDate} currentWeight={profile.poids_kg} onSave={handleSaveWeight} />
      )}

      {/* 4. Progression de l'objectif : information de fond, après le suivi du jour */}
      {activeGoal && activeGoal.target_weight_kg && profile && (
        <GoalProgressCard goal={activeGoal} currentWeight={profile.poids_kg} />
      )}

      {/* Mobile : bouton « Ajouter » flottant, toujours visible au-dessus de la barre d'onglets */}
      {!showAddModal && (
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          aria-label="Ajouter un aliment"
          className="sm:hidden fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-on-color shadow-lg shadow-brand-600/30 transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
        >
          <Plus className="h-7 w-7" aria-hidden="true" />
        </button>
      )}

      {showAddModal && (
        <AddEntryModal
          date={selectedDate}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEntry}
        />
      )}
    </div>
  );
}
