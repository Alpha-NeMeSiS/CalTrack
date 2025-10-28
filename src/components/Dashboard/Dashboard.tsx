import { useState, useEffect } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { supabase, DailyTarget, Entry, Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateDailySummary } from '../../utils/calculations';
import { CalorieRing } from './CalorieRing';
import { MacroCard } from './MacroCard';
import { GoalProgressCard } from './GoalProgressCard';
import { AddEntryModal } from '../Journal/AddEntryModal';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDayData();
    }
  }, [user, selectedDate]);

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

      setTarget(targetResult.data);
      setEntries(entriesResult.data || []);
      setActiveGoal(goalResult.data);
    } catch (error) {
      console.error('Error loading day data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async (entryData: any) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('entries').insert({
        user_id: user.id,
        date: selectedDate,
        ...entryData,
      });

      if (error) throw error;

      await loadDayData();
    } catch (error) {
      console.error('Error adding entry:', error);
    }
  };

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

  if (!target) {
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
                window.dispatchEvent(new CustomEvent('navigate-to-board'));
              }}
              className="inline-block px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors"
            >
              Retour au tableau de bord
            </a>
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
            onChange={(e) => setSelectedDate(e.target.value)}
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
          <h2 className="text-xl text-shonen-700">Journal du jour</h2>
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
