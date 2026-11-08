// Bibliothèque d'aliments de l'utilisateur, chargée à l'ouverture de la
// fenêtre d'ajout : aliments récents (journal), favoris et aliments personnels.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entry, FavoriteFood, Food } from '../../lib/supabase';
import {
  addFavorite,
  deletePersonalFood,
  fetchFavorites,
  fetchPersonalFoods,
  fetchRecentEntries,
  removeFavorite,
  savePersonalFood,
} from '../../services/foods';
import type { NormalizedFood } from '../../types/food';
import {
  buildFavoritePayload,
  buildRecentFoods,
  favoriteToQuickFood,
  foodKey,
  foodLabel,
  personalFoodToNormalized,
  PortionValues,
  QuickFood,
} from '../../utils/foodLibrary';

/** Nombre de récents affichés (hors favoris) */
const RECENTS_SHOWN = 8;

export function useFoodLibrary(userId: string | undefined) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [personalFoods, setPersonalFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      // Chaque source est indépendante : une erreur n'empêche pas les autres
      const [recent, favs, personal] = await Promise.allSettled([
        fetchRecentEntries(userId),
        fetchFavorites(userId),
        fetchPersonalFoods(userId),
      ]);
      if (!active) return;
      if (recent.status === 'fulfilled') setEntries(recent.value);
      if (favs.status === 'fulfilled') setFavorites(favs.value);
      if (personal.status === 'fulfilled') setPersonalFoods(personal.value);
      if ([recent, favs, personal].some((result) => result.status === 'rejected')) {
        setError('Une partie de vos aliments n’a pas pu être chargée. Vérifiez votre connexion.');
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const recentFoods = useMemo(() => buildRecentFoods(entries, RECENTS_SHOWN * 3), [entries]);

  // Favoris : avec le repas habituel tiré du journal quand il est connu
  const favoriteFoods = useMemo<QuickFood[]>(() => {
    const recentByKey = new Map(recentFoods.map((item) => [item.key, item]));
    return favorites.map((favorite) => {
      const item = favoriteToQuickFood(favorite);
      return { ...item, usualMeal: recentByKey.get(item.key)?.usualMeal };
    });
  }, [favorites, recentFoods]);

  const favoriteKeys = useMemo(() => new Set(favoriteFoods.map((item) => item.key)), [favoriteFoods]);
  const recentsShown = useMemo(
    () => recentFoods.filter((item) => !favoriteKeys.has(item.key)).slice(0, RECENTS_SHOWN),
    [recentFoods, favoriteKeys]
  );

  const personalNormalized = useMemo(() => personalFoods.map(personalFoodToNormalized), [personalFoods]);

  /** Favori correspondant à un aliment (même libellé), s'il existe */
  const findFavorite = useCallback(
    (food: NormalizedFood) => favorites.find((favorite) => foodKey(favorite.label) === foodKey(foodLabel(food))),
    [favorites]
  );

  /** Ajoute ou retire un aliment des favoris (quantité habituelle = quantité donnée). */
  const toggleFavorite = useCallback(
    async (food: NormalizedFood, quantity: number) => {
      if (!userId) return;
      const existing = findFavorite(food);
      if (existing) {
        await removeFavorite(existing.id);
        setFavorites((current) => current.filter((favorite) => favorite.id !== existing.id));
      } else {
        const created = await addFavorite(buildFavoritePayload(userId, food, quantity));
        setFavorites((current) => [...current, created]);
      }
    },
    [findFavorite, userId]
  );

  const savePersonal = useCallback(
    async (values: PortionValues, barcode?: string | null) => {
      if (!userId) throw new Error('Utilisateur non connecté');
      const saved = await savePersonalFood(userId, values, barcode);
      setPersonalFoods((current) =>
        [...current.filter((food) => food.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      );
      return saved;
    },
    [userId]
  );

  const deletePersonal = useCallback(async (foodId: string) => {
    await deletePersonalFood(foodId);
    setPersonalFoods((current) => current.filter((food) => food.id !== foodId));
  }, []);

  /** Quantité et repas habituels d'un aliment (favori ou déjà saisi au journal) */
  const usualFor = useCallback(
    (food: NormalizedFood): Pick<QuickFood, 'usualQty' | 'usualMeal'> | null => {
      const key = foodKey(foodLabel(food));
      const match = favoriteFoods.find((item) => item.key === key) ?? recentFoods.find((item) => item.key === key);
      return match ? { usualQty: match.usualQty, usualMeal: match.usualMeal } : null;
    },
    [favoriteFoods, recentFoods]
  );

  return {
    loading,
    error,
    usualFor,
    favoriteFoods,
    recentFoods: recentsShown,
    personalFoods: personalNormalized,
    isFavorite: (food: NormalizedFood) => Boolean(findFavorite(food)),
    toggleFavorite,
    savePersonal,
    deletePersonal,
  };
}
