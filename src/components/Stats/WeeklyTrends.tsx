// Importation des dépendances React nécessaires
import { useState, useEffect } from 'react';
// Importation des icônes pour les tendances
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
// Importation de la configuration Supabase
import { supabase } from '../../lib/supabase';
// Importation du contexte d'authentification
import { useAuth } from '../../contexts/AuthContext';
// Importation des fonctions de calcul
import { calculateDailySummary } from '../../utils/calculations';

// Interface pour les objectifs nutritionnels
interface Goal {
  id: string;
  user_id: string;
  type: 'loss' | 'maintain' | 'gain'; // Type d'objectif: perte, maintien ou gain de poids
  is_active: boolean;
  start_date: string;
  end_date: string;
  duration_weeks: number;
}

// Interface pour les entrées du journal alimentaire
interface Entry {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // Type de repas
  food_name: string;
  serving_size_g: number;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  created_at: string;
}

// Interface pour les objectifs quotidiens
interface DailyTarget {
  id: string;
  user_id: string;
  date: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  goal_id: string;
}

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
  consumed: MacroSummary;  // Macronutriments consommés
  target: MacroSummary;    // Objectifs de macronutriments
  status: 'under' | 'ok' | 'over';  // Statut par rapport à l'objectif
}

// Type pour les données hebdomadaires
type WeekDataItem = {
  date: string;
  summary: DailySummary | null;  // Peut être null si pas de données pour ce jour
}

// Composant principal pour afficher les tendances hebdomadaires
export function WeeklyTrends() {
  // Récupération de l'utilisateur depuis le contexte d'authentification
  const { user } = useAuth();
  // États pour gérer le chargement et les données
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<WeekDataItem[]>([]); // Données des 7 derniers jours
  const [monthData, setMonthData] = useState<WeekDataItem[]>([]); // Données des 30 derniers jours

  // Effet pour charger les données au montage du composant
  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [user]);

  // Fonction pour charger les données de la semaine et du mois
  const loadWeekData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Calcul des dates pour la période d'analyse
      const today = new Date();
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 30); // Date d'il y a 30 jours

      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6); // Date d'il y a 6 jours

      // Formatage des dates pour la requête
      const startDate = monthAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Récupération parallèle des objectifs et des entrées depuis Supabase
      const [targetsResult, entriesResult] = await Promise.all([
        // Requête pour les objectifs quotidiens
        supabase
          .from('daily_targets')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
        // Requête pour les entrées du journal
        supabase
          .from('entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date'),
      ]);

      // Vérification des erreurs de requête
      if (targetsResult.error) throw targetsResult.error;
      if (entriesResult.error) throw entriesResult.error;

      // Extraction des données des résultats
      const targets = targetsResult.data || [];
      const entries = entriesResult.data || [];

      // Préparation des données pour le graphique des 7 derniers jours
      const weekData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Recherche des données pour ce jour
        const dayTarget = targets.find((t) => t.date === dateStr);
        const dayEntries = entries.filter((e) => e.date === dateStr);

        if (dayTarget) {
          // Calcul du résumé quotidien si un objectif existe
          const summary = calculateDailySummary(dayEntries, dayTarget, dateStr);
          weekData.push({ date: dateStr, summary });
        } else {
          // Pas de données pour ce jour
          weekData.push({ date: dateStr, summary: null });
        }
      }

      // Préparation des données pour l'historique détaillé (30 derniers jours)
      const monthData = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Recherche des données pour ce jour
        const dayTarget = targets.find((t) => t.date === dateStr);
        const dayEntries = entries.filter((e) => e.date === dateStr);

        if (dayTarget) {
          // Calcul du résumé quotidien si un objectif existe
          const summary = calculateDailySummary(dayEntries, dayTarget, dateStr);
          monthData.push({ date: dateStr, summary });
        } else {
          // Pas de données pour ce jour
          monthData.push({ date: dateStr, summary: null });
        }
      }

      setWeekData(weekData);
      setMonthData(monthData);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl text-gray-900 mb-4">Tendances 7 jours</h2>
        <div className="text-center py-8 text-gray-500">Chargement...</div>
      </div>
    );
  }

  // Filtrage des jours avec des données valides
  const validDays = weekData.filter((d): d is WeekDataItem & { summary: DailySummary } => d.summary !== null);
  
  // Calcul de la moyenne des calories consommées
  const avgCalories =
    validDays.length > 0
      ? Math.round(validDays.reduce((sum, d) => sum + d.summary.consumed.calories_kcal, 0) / validDays.length)
      : 0;
  
  // Calcul de la moyenne des objectifs caloriques
  const avgTarget =
    validDays.length > 0
      ? Math.round(validDays.reduce((sum, d) => sum + d.summary.target.calories_kcal, 0) / validDays.length)
      : 0;

  // Calcul des statistiques d'atteinte des objectifs
  const statusCount = {
    under: validDays.filter((d) => d.summary.status === 'under').length,  // Jours sous l'objectif
    ok: validDays.filter((d) => d.summary.status === 'ok').length,        // Jours dans l'objectif
    over: validDays.filter((d) => d.summary.status === 'over').length,    // Jours au-dessus de l'objectif
  };

  // Calcul du maximum des calories pour l'échelle du graphique
  // Utilise 2000 comme minimum pour éviter une échelle trop petite
  const maxCalories = Math.max(
    ...validDays.map((d) => Math.max(d.summary.consumed.calories_kcal, d.summary.target.calories_kcal)),
    2000
  );

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl text-gray-900">Tendances et historique</h2>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Graphique des calories</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="relative h-64">
              {/* Axe Y avec graduations pour l'échelle des calories */}
              <div className="absolute left-0 top-0 h-full w-16 flex flex-col justify-between text-xs text-gray-500 py-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center">
                    <span className="mr-2">{Math.round((maxCalories * (5 - i)) / 5)}</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                ))}
              </div>

              {/* Container pour les barres du graphique */}
              <div className="absolute inset-0 flex items-end justify-between gap-2 pb-6 pl-16 pr-4">
                {(() => {
                  // Configuration de la hauteur du graphique en pixels pour éviter les problèmes de mise en page
                  const CHART_HEIGHT_PX = 200; // hauteur utilisable pour les barres en pixels

                  // Fonction pour déterminer la couleur de la barre en fonction du rapport consommé/objectif
                  const getBarColor = (consumed: number, target: number) => {
                    if (!target || target <= 0) return 'bg-gray-300';  // Pas d'objectif défini
                    const percentage = (consumed / target) * 100;
                    if (percentage >= 95 && percentage <= 105) return 'bg-green-500';  // À l'objectif (±5%)
                    if (percentage < 95) {
                      if (percentage < 75) return 'bg-orange-600';  // Très en dessous de l'objectif (<75%)
                      return 'bg-orange-400';  // En dessous de l'objectif (75-95%)
                    }
                    if (percentage > 105) {
                      if (percentage > 125) return 'bg-red-600';  // Très au-dessus de l'objectif (>125%)
                      return 'bg-red-400';  // Au-dessus de l'objectif (105-125%)
                    }
                    return 'bg-gray-300';  // Cas par défaut
                  };

                  // Génération des barres du graphique pour chaque jour
                  return weekData.map((day) => {
                    // Récupération des calories consommées et de l'objectif
                    const consumed = day.summary?.consumed.calories_kcal ?? 0;
                    const target = day.summary?.target.calories_kcal ?? 0;

                    // Calcul de la hauteur de la barre en pixels
                    // Minimum de 6px pour garantir la visibilité
                    const heightPx = day.summary
                      ? Math.max(6, Math.round((consumed / Math.max(1, maxCalories)) * CHART_HEIGHT_PX))
                      : 6;

                    // Calcul de la hauteur de la ligne d'objectif en pixels
                    const targetPx = day.summary
                      ? Math.round((target / Math.max(1, maxCalories)) * CHART_HEIGHT_PX)
                      : 0;

                    // Détermination de la couleur de la barre selon le rapport consommé/objectif
                    const statusColor = day.summary ? getBarColor(consumed, target) : 'bg-gray-300';

                    // Préparation du contenu de l'infobulle
                    const tooltipContent = day.summary
                      ? `Consommé: ${Math.round(consumed)} kcal\nObjectif: ${Math.round(target)} kcal\n(${Math.round((consumed / Math.max(1, target || 1)) * 100)}%)\nFibre: ${Math.round(day.summary.consumed.fiber_g || 0)} g / ${Math.round(day.summary.target.fiber_g || 0)} g`
                      : 'Pas de données';

                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1 relative group">
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line">
                          {tooltipContent}
                        </div>

                        <div className="w-full relative flex items-end justify-center" style={{ height: `${CHART_HEIGHT_PX}px` }}>
                          {/* vertical grid line */}
                          <div className="absolute inset-0 border-l border-gray-200" />

                          {day.summary ? (
                            <>
                              <div
                                className="absolute bottom-0 w-full border-t-2 border-dashed border-blue-400"
                                style={{ bottom: `${targetPx}px` }}
                                title={`Objectif: ${Math.round(target)} kcal`}
                              />

                              <div
                                className={`relative w-full ${statusColor} rounded-t transition-all duration-300 hover:opacity-80 flex items-end justify-center`}
                                style={{ height: `${heightPx}px` }}
                                title={`${Math.round(consumed)} kcal`}
                              />
                            </>
                          ) : (
                            <div className="absolute bottom-0 w-full h-2 bg-gray-200 rounded-t" />
                          )}
                        </div>

                        <div className="text-xs text-gray-600 font-medium capitalize">
                          {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-gray-600">À l'objectif</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-400 rounded" />
                <span className="text-gray-600">En dessous</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-gray-600">Au-dessus</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 border-t-2 border-dashed border-blue-400" />
                <span className="text-gray-600">Objectif</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Historique détaillé (30 jours)</h3>
          <div className="space-y-2 h-[400px] overflow-y-auto pr-2 scrollbar scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 scrollbar-track-transparent">
            {monthData.map((day) => {
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

              if (!day.summary) {
                return (
                  <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-16 text-sm font-medium text-gray-600 capitalize">{dayName}</div>
                      <div className="text-xs text-gray-500">{dateStr}</div>
                    </div>
                    <div className="text-sm text-gray-400">Pas de données</div>
                  </div>
                );
              }

              const statusConfig: Record<'under' | 'ok' | 'over', { bg: string; text: string; label: string }> = {
                under: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'Sous' },
                ok: { bg: 'bg-green-50', text: 'text-green-600', label: 'OK' },
                over: { bg: 'bg-red-50', text: 'text-red-600', label: 'Au-dessus' },
              };

              const config = statusConfig[day.summary.status];

              return (
                <div key={day.date} className={`flex items-center justify-between p-3 ${config.bg} rounded-md`}>
                  <div className="flex items-center gap-3">
                    <div className="w-16 text-sm font-medium text-gray-900 capitalize">{dayName}</div>
                    <div className="text-xs text-gray-600">{dateStr}</div>
                  </div>

                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-700">
                        <div className="flex items-baseline gap-1">
                          <span className="font-semibold">{Math.round(day.summary.consumed.calories_kcal)}</span>
                          <span className="text-gray-500"> / {Math.round(day.summary.target.calories_kcal)} kcal</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                          <div>P: <span className="font-semibold">{Math.round(day.summary.consumed.protein_g)} g</span> / {Math.round(day.summary.target.protein_g)} g</div>
                          <div>L: <span className="font-semibold">{Math.round(day.summary.consumed.fat_g)} g</span> / {Math.round(day.summary.target.fat_g)} g</div>
                          <div>G: <span className="font-semibold">{Math.round(day.summary.consumed.carbs_g)} g</span> / {Math.round(day.summary.target.carbs_g)} g</div>
                          <div>F: <span className="font-semibold">{Math.round(day.summary.consumed.fiber_g || 0)} g</span> / {Math.round(day.summary.target.fiber_g || 0)} g</div>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${config.text} self-start mt-1`}>
                        {config.label}
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
