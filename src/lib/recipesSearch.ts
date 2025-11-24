import { GeneratedRecipe } from '../types/fridge';

// Placeholder d'appel à une API externe de recettes (Spoonacular / Edamam / etc.)
// Pour l'instant on renvoie quelques résultats tests compatibles avec les aliments fournis.
export async function searchHealthyRecipesOnWeb(
  ingredients: string[],
  goal: 'loss' | 'maintain' | 'gain',
): Promise<GeneratedRecipe[]> {
  const baseTag = goal === 'loss' ? 'léger' : goal === 'gain' ? 'énergétique' : 'équilibré';
  const sample: GeneratedRecipe[] = [
    {
      id: 'web-salade-proteinee',
      title: 'Salade protéinée express',
      description: "Une salade rapide inspirée d'API externe, adaptée aux restes du frigo.",
      ingredients: [
        { name: ingredients[0] ?? 'Légume croquant', approxQuantity: '1 portion' },
        { name: ingredients[1] ?? 'Source protéine', approxQuantity: '1 portion' },
      ],
      estimatedPrepMinutes: 10,
      tags: ['internet', baseTag, 'rapide'],
    },
    {
      id: 'web-bowl-frais',
      title: 'Bowl frais web',
      description: 'Suggestion issue du web pour varier : base crudités + protéine + sauce yaourt.',
      ingredients: [
        { name: ingredients[0] ?? 'Base de crudités', approxQuantity: '1 bol' },
        { name: ingredients[2] ?? 'Sauce yaourt', approxQuantity: '1 cuillère' },
      ],
      estimatedPrepMinutes: 14,
      tags: ['internet', baseTag],
    },
  ];

  return sample;
}
