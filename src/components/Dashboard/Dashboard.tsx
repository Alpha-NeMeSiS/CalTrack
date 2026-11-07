// Tableau de bord principal
// Affiche l'anneau calorique, les macrocarts, le journal du jour et gère la création/suppression d'entrées
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { supabase, DailyTarget, Entry, Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { calculateDailySummary } from '../../utils/calculations';
import { getTodayDate, isDateOnlyString } from '../../utils/date';
import { findGoalForDate } from '../../utils/goals';
import { ensureDailyTargetForDate, fetchUserGoals } from '../../services/goals';
import { CalorieRing } from './CalorieRing';
import { MacroCard } from './MacroCard';
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
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(activeDate ?? getTodayDate());
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [goalForDate, setGoalForDate] = useState<Goal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  useEffect(() => {
    loadDayData();
  }, [loadDayData]);

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

  const handleDateChange = (nextDate: string) => {
    // Champ vidé ou date incomplète : on garde la date courante
    if (!isDateOnlyString(nextDate)) return;
    setActionError(null);
    setSelectedDate(nextDate);
    onActiveDateChange?.(nextDate);
  };

  // En-tête toujours affiché : il permet de changer de date même quand la
  // journée n'a pas d'objectif ou n'a pas pu être chargée.
  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-gray-600" aria-hidden="true" />
        <input
          type="date"
          aria-label="Date affichée"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          max={getTodayDate()}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-kaizen-500"
        />
      </div>

      {target && !loading && !loadError && (
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-kaizen flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
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
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        {header}
        <div className="max-w-2xl mx-auto text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-700 mb-4">{loadError}</p>
            <button onClick={() => loadDayData()} className="btn-kaizen">
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg text-yellow-900 mb-2">
              Aucun objectif défini pour cette date
            </h3>
            <p className="text-yellow-700 mb-4">
              {goalForDate
                ? "Impossible de calculer la cible de cette journée."
                : 'Vous devez définir un objectif pour commencer le suivi de vos apports.'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-settings'))}
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Aller aux paramètres
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = calculateDailySummary(entries, target, selectedDate);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {header}

      {actionError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {actionError}
        </div>
      )}

      {activeGoal && activeGoal.target_weight_kg && profile && (
        <GoalProgressCard goal={activeGoal} currentWeight={profile.poids_kg} />
      )}

      <div className="card-kaizen">
        <div className="flex flex-col lg:flex-row items-center gap-8 p-6">
          <div className="flex-shrink-0">
            <CalorieRing
              consumed={summary.consumed.calories_kcal}
              target={summary.target.calories_kcal}
              status={summary.status}
            />
          </div>

          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4">
            <MacroCard
              label="Protéines"
              consumed={summary.consumed.protein_g}
              target={summary.target.protein_g}
              unit="g"
              color="bg-kaizen-500"
            />
            <MacroCard
              label="Lipides"
              consumed={summary.consumed.fat_g}
              target={summary.target.fat_g}
              unit="g"
              color="bg-shonen-300"
            />
            <MacroCard
              label="Glucides"
              consumed={summary.consumed.carbs_g}
              target={summary.target.carbs_g}
              unit="g"
              color="bg-kaizen-300"
            />
            <MacroCard
              label="Fibres"
              consumed={summary.consumed.fiber_g}
              target={summary.target.fiber_g ?? 25}
              unit="g"
              color="bg-emerald-400"
            />
          </div>
        </div>
      </div>

      <div className="card-kaizen">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-lg text-shonen-700">Journal du jour</h2>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <p>Aucun aliment enregistré pour cette journée</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 btn-kaizen"
            >
              Ajouter votre premier aliment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-white/6 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-shonen-700">{entry.label || 'Aliment sans nom'}</span>
                      {entry.meal_type && (
                        <span className="text-xs px-2 py-1 bg-white/6 text-gray-600 rounded">
                          {entry.meal_type === 'breakfast' && 'Petit-déj'}
                          {entry.meal_type === 'lunch' && 'Déjeuner'}
                          {entry.meal_type === 'dinner' && 'Dîner'}
                          {entry.meal_type === 'snack' && 'Collation'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {entry.qty_grammes}g · {Math.round(entry.kcal)} kcal
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      P: {entry.protein_g}g · L: {entry.fat_g}g · G: {entry.carbs_g}g
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteEntry(entry.id, entry.label)}
                    aria-label={`Supprimer ${entry.label || 'cet aliment'}`}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
