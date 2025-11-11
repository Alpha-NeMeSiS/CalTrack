// Modal pour ajouter une entrée alimentaire
// Permet de rechercher un aliment, saisir la quantité et obtenir les valeurs nutritionnelles calculées
import { useState } from 'react';
import { X } from 'lucide-react';
import { FoodSearch } from '../Foods/FoodSearch';
import type { NormalizedFood } from '../../types/food';

interface AddEntryModalProps {
  date: string;
  onClose: () => void;
  onAdd: (entry: {
    food_id?: string;
    label: string;
    qty_grammes: number;
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g: number;
    meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  }) => void;
}

export function AddEntryModal({ onClose, onAdd }: AddEntryModalProps) {
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFood) return;

    const multiplier = quantity / 100;
    const calculated = (value: number) => Math.round(value * multiplier * 10) / 10;
    const id =
      selectedFood.source === 'ciqual' && selectedFood.extCode
        ? `ciqual:${selectedFood.extCode}`
        : selectedFood.source === 'off' && selectedFood.offCode
          ? `off:${selectedFood.offCode}`
          : undefined;

    onAdd({
      food_id: id,
      label: selectedFood.brand ? `${selectedFood.brand} ${selectedFood.name}` : selectedFood.name,
      qty_grammes: quantity,
      kcal: Math.round(selectedFood.kcal_per_100g * multiplier),
      protein_g: calculated(selectedFood.protein_g),
      fat_g: calculated(selectedFood.fat_g),
      carbs_g: calculated(selectedFood.carbs_g),
      fiber_g: calculated(selectedFood.fiber_g),
      meal_type: mealType,
    });

    onClose();
  };

  const multiplier = quantity / 100;
  const calculatedCalories = selectedFood ? Math.round(selectedFood.kcal_per_100g * multiplier) : 0;
  const calculated = (value: number) => Math.round(value * multiplier * 10) / 10;
  const calculatedProtein = selectedFood ? calculated(selectedFood.protein_g) : 0;
  const calculatedFat = selectedFood ? calculated(selectedFood.fat_g) : 0;
  const calculatedCarbs = selectedFood ? calculated(selectedFood.carbs_g) : 0;
  const calculatedFiber = selectedFood ? calculated(selectedFood.fiber_g) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-8 pt-8 pb-10 border-b border-gray-200">
          <h2 className="text-xl text-gray-900">Ajouter un aliment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aliment</label>
            {/* Sélection d'aliment via le composant de recherche */}
            <FoodSearch
              onSelect={(food) => {
                setSelectedFood(food);
                setQuantity(100);
              }}
            />
            {selectedFood && (
              <div className="mt-3 flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                {selectedFood.imageUrl && (
                  <img
                    src={selectedFood.imageUrl}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div>
                  <div className="font-medium text-blue-900">
                    {selectedFood.brand ? `${selectedFood.brand} ${selectedFood.name}` : selectedFood.name}
                  </div>
                  <div className="mt-1 text-sm text-blue-700">
                    {Math.round(selectedFood.kcal_per_100g)} kcal pour 100 g
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedFood && (
            <>
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité (grammes)
                </label>
                <input
                  type="number"
                  id="quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min="1"
                  step="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type de repas (optionnel)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'breakfast', label: 'Petit-déjeuner' },
                    { value: 'lunch', label: 'Déjeuner' },
                    { value: 'dinner', label: 'Dîner' },
                    { value: 'snack', label: 'Collation' },
                  ].map((meal) => (
                    <button
                      key={meal.value}
                      type="button"
                      onClick={() => setMealType(mealType === meal.value ? undefined : (meal.value as typeof mealType))}
                      className={`py-2 px-3 text-sm border-2 rounded-md font-medium transition-colors ${
                        mealType === meal.value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {meal.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-sm text-gray-900 mb-2">Valeurs nutritionnelles</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Calories :</div>
                  <div className="font-medium text-gray-900">{calculatedCalories} kcal</div>
                  <div className="text-gray-600">Protéines :</div>
                  <div className="font-medium text-gray-900">{calculatedProtein} g</div>
                  <div className="text-gray-600">Lipides :</div>
                  <div className="font-medium text-gray-900">{calculatedFat} g</div>
                  <div className="text-gray-600">Glucides :</div>
                  <div className="font-medium text-gray-900">{calculatedCarbs} g</div>
                  <div className="text-gray-600">Fibres :</div>
                  <div className="font-medium text-gray-900">{calculatedFiber} g</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
