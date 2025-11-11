// Tableau de bord principal
// Affiche l'anneau calorique, les macrocarts, le journal du jour et gère la création/suppression d'entrées
import { useState, useEffect } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { supabase, DailyTarget, Entry, Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDailySummary } from '../../utils/calculations';
import { CalorieRing } from './CalorieRing';
import { MacroCard } from './MacroCard';
import { GoalProgressCard } from './GoalProgressCard';
import { AddEntryModal } from '../Journal/AddEntryModal';

function isDateWithinGoal(goal: Goal | null, date: string): boolean {
  if (!goal?.start_date || !goal?.end_date) {
    return false;
  }

  return goal.start_date <= date && date <= goal.end_date;
}

// Ensure there is a daily target for the given date. If missing but an active
// goal covers the date, derive the target values (copy from the goal's first
// day when possible, otherwise from the goal fields) and upsert the
// daily_target. Return the resulting DailyTarget or null.
async function ensureDailyTargetForDate(userId: string, dateStr: string): Promise<DailyTarget | null> {
  try {
    const { data: existingTarget, error: existingError } = await supabase
      .from('daily_targets')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .maybeSingle();

    if (existingError) {
      console.error('Error querying existing daily_target:', existingError);
      return null;
    }

    if (existingTarget) {
      return existingTarget as DailyTarget;
    }

    const { data: activeGoal, error: goalError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalError) {
      console.error('Error querying active goal:', goalError);
      return null;
    }

    const goal = (activeGoal as Goal | null) ?? null;

    if (!isDateWithinGoal(goal, dateStr)) {
      return null;
    }

    let payload: {
      user_id: string;
      date: string;
      calories_kcal: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
      fiber_g: number;
      goal_id: string;
    } | null = null;

    if (goal?.start_date) {
      const { data: firstDayTarget, error: firstDayError } = await supabase
        .from('daily_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('date', goal.start_date)
        .maybeSingle();

      if (firstDayError) {
        console.error('Error querying first day daily_target:', firstDayError);
      } else if (firstDayTarget) {
        const src = firstDayTarget as DailyTarget;
        payload = {
          user_id: userId,
          date: dateStr,
          calories_kcal: src.calories_kcal,
          protein_g: src.protein_g,
          fat_g: src.fat_g,
          carbs_g: src.carbs_g,
          fiber_g: src.fiber_g ?? 0,
          goal_id: src.goal_id ?? goal.id,
        };
      }
    }

    if (!payload) {
      if (
        goal?.calories_kcal == null ||
        goal.protein_g == null ||
        goal.fat_g == null ||
        goal.carbs_g == null
      ) {
        return null;
      }

      payload = {
        user_id: userId,
        date: dateStr,
        calories_kcal: goal.calories_kcal,
        protein_g: goal.protein_g,
        fat_g: goal.fat_g,
        carbs_g: goal.carbs_g,
        fiber_g: goal.fiber_g ?? 0,
        goal_id: goal.id,
      };
    }

    const { data: upsertedTarget, error: upsertError } = await supabase
      .from('daily_targets')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error('Error upserting daily_target:', upsertError);
      return null;
    }

    return (upsertedTarget as DailyTarget) ?? null;
  } catch (err) {
    console.error('Unexpected error in ensureDailyTargetForDate:', err);
    return null;
  }
}

export function Dashboard() {
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Recharger les données lorsque l'utilisateur ou la date sélectionnée change
  useEffect(() => {
    if (user) {
      loadDayData();
    }
  }, [user, selectedDate]);

  // Charge les données du jour : target, entrées et objectif actif
  const loadDayData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [targetResult, entriesResult, goalResult] = await Promise.all([
        supabase
          .from('daily_targets')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', selectedDate)
          .maybeSingle(),
        supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', selectedDate)
          .order('created_at', { ascending: true }),
        supabase
          .from('goals')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (targetResult.error) throw targetResult.error;
      if (entriesResult.error) throw entriesResult.error;
      if (goalResult.error) throw goalResult.error;

      let finalTarget: DailyTarget | null = (targetResult.data as DailyTarget | null) ?? null;
      if (!finalTarget) {
        finalTarget = await ensureDailyTargetForDate(user.id, selectedDate);
      }

      setTarget(finalTarget);
      setEntries(entriesResult.data || []);
      setActiveGoal((goalResult.data as Goal | null) ?? null);
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Ajoute une entrée dans la table 'entries' puis recharge les données
  const handleAddEntry = async (entryData: any) => {
    if (!user) return;

    try {
      const cleanedEntry = { ...entryData };
      if ('food_id' in cleanedEntry) {
        const value = cleanedEntry.food_id;
        const isUuid = typeof value === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (!isUuid) {
          delete cleanedEntry.food_id;
        }
      }

      const { error } = await supabase.from('entries').insert({
        user_id: user.id,
        date: selectedDate,
        ...cleanedEntry,
      });

      if (error) throw error;

      await loadDayData();
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

  // Supprime une entrée puis recharge les données
  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase.from('entries').delete().eq('id', entryId);

      if (error) throw error;

      await loadDayData();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  const goalCoversSelectedDate = isDateWithinGoal(activeGoal, selectedDate);

  if (!target) {
    if (goalCoversSelectedDate) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg text-yellow-900 mb-2">
            Aucun objectif défini pour cette date
          </h3>
          <p className="text-yellow-700 mb-4">
            Vous devez définir un objectif pour commencer le suivi de vos apports.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('navigate-to-settings'));
              }}
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
            >
              Aller aux paramètres
            </a>
          </div>
        </div>
      </div>
    );
  }

  const summary = calculateDailySummary(entries, target, selectedDate);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-gray-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const nextDate = e.target.value;
              setSelectedDate(nextDate);
              onActiveDateChange?.(nextDate);
            }}
            max={new Date().toISOString().split('T')[0]}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-kaizen-500"
          />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-kaizen flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ajouter
        </button>
      </div>

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
          <h2 className="text- text-shonen-700">Journal du jour</h2>
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
                      <span className="font-medium text-shonen-700">{entry.label}</span>
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
                    onClick={() => handleDeleteEntry(entry.id)}
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
