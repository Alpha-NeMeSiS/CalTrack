import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase, Food } from '../../lib/supabase';

interface FoodSearchProps {
  onSelect: (food: Food) => void;
}

export function FoodSearch({ onSelect }: FoodSearchProps) {
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setFoods([]);
      return;
    }

    const timer = setTimeout(() => {
      searchFoods(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const searchFoods = async (query: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(20);

      if (error) throw error;
      setFoods(data || []);
    } catch (error) {
      console.error('Error searching foods:', error);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un aliment..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {search.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Recherche...</div>
          ) : foods.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Aucun résultat</div>
          ) : (
            <div>
              {foods.map((food) => (
                <button
                  key={food.id}
                  onClick={() => {
                    onSelect(food);
                    setSearch('');
                    setFoods([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900">{food.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {food.kcal_per_100g} kcal · P: {food.protein_g}g · L: {food.fat_g}g · G: {food.carbs_g}g (pour 100g)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
