import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeEntry, makeRecipe } from '../../test/fixtures';
import { RecipeEditor } from './RecipeEditor';
import { RecipeList } from './RecipeList';
import { RecipePortion } from './RecipePortion';
import { RecipesTab } from './RecipesTab';
import * as recipesService from '../../services/recipes';

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

// La recherche réelle est testée dans FoodSearch.test.tsx : un bouton simule
// le choix d'un aliment (lentilles cuites, 116 kcal pour 100 g).
vi.mock('../Foods/FoodSearch', () => ({
  FoodSearch: ({ onSelect }: { onSelect: (food: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSelect({ source: 'ciqual', name: 'Lentilles, cuites', kcal_per_100g: 116, protein_g: 9, fat_g: 0.4, carbs_g: 20, fiber_g: 8 })
      }
    >
      Choisir des lentilles
    </button>
  ),
}));

const listProps = {
  loading: false,
  error: null,
  onRetry: vi.fn(),
  onCreate: vi.fn(),
  onEdit: vi.fn(),
  onPick: vi.fn(),
  onQuickAdd: vi.fn(),
};

describe('RecipeList', () => {
  it('explique l’intérêt des recettes quand il n’y en a aucune', () => {
    render(<RecipeList {...listProps} recipes={[]} />);
    expect(screen.getByText(/Enregistrez vos plats maison/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvelle recette/ })).toBeInTheDocument();
  });

  it('affiche les parts et les kcal par part, et ajoute une part en un geste', async () => {
    const onQuickAdd = vi.fn();
    const onEdit = vi.fn();
    const recipe = makeRecipe();
    render(<RecipeList {...listProps} recipes={[recipe]} onQuickAdd={onQuickAdd} onEdit={onEdit} />);

    expect(screen.getByText('4 parts · 491 kcal la part · poids cuit 1 800 g')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter 1 part de « Chili maison » au journal' }));
    expect(onQuickAdd).toHaveBeenCalledWith(recipe);
    await user.click(screen.getByRole('button', { name: 'Modifier « Chili maison »' }));
    expect(onEdit).toHaveBeenCalledWith(recipe);
  });

  it('propose de réessayer quand le chargement échoue', async () => {
    const onRetry = vi.fn();
    render(<RecipeList {...listProps} recipes={[]} error="Vos recettes n’ont pas pu être chargées." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Vos recettes n’ont pas pu être chargées.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('RecipeEditor', () => {
  it('compose une recette depuis la recherche et calcule les totaux en direct', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RecipeEditor onSave={onSave} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nom de la recette'), 'Dahl');
    await user.click(screen.getByRole('button', { name: 'Retirer une part' })); // 4 → 3
    await user.click(screen.getByRole('button', { name: '+ Ajouter un ingrédient' }));
    await user.click(screen.getByRole('button', { name: 'Choisir des lentilles' }));
    await user.clear(screen.getByLabelText('Quantité (g)'));
    await user.type(screen.getByLabelText('Quantité (g)'), '300');
    await user.click(screen.getByRole('button', { name: 'Ajouter à la recette' }));

    // 300 g × 116 kcal / 100 = 348 kcal ; 3 parts → 116 kcal la part (100 g cru)
    expect(screen.getByText('Lentilles, cuites')).toBeInTheDocument();
    expect(screen.getByText('Total (300 g cru)')).toBeInTheDocument();
    expect(screen.getByText('348 kcal', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Par part (100 g cru)')).toBeInTheDocument();

    // Modifier la quantité met à jour les totaux
    const qty = screen.getByLabelText('Quantité de « Lentilles, cuites » en grammes');
    await user.clear(qty);
    await user.type(qty, '600');
    expect(screen.getByText('Total (600 g cru)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      name: 'Dahl',
      servings: 3,
      cooked_weight_g: null,
      ingredients: [{ label: 'Lentilles, cuites', qty_g: 600, kcal_per_100g: 116, protein_g: 9, fat_g: 0.4, carbs_g: 20, fiber_g: 8 }],
    });
  });

  it('refuse d’enregistrer une recette sans ingrédient ou avec une quantité nulle', async () => {
    const onSave = vi.fn();
    render(<RecipeEditor initial={makeRecipe()} onSave={onSave} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    const qty = screen.getByLabelText('Quantité de « Riz blanc, cuit » en grammes');
    await user.clear(qty);
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La quantité de chaque ingrédient doit être comprise entre 1 et 5 000 g.');

    for (const label of ['Haricots rouges, cuits', 'Bœuf haché 5 %, cru', 'Tomates concassées', 'Riz blanc, cuit']) {
      await user.click(screen.getByRole('button', { name: `Retirer « ${label} »` }));
    }
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ajoutez au moins un ingrédient.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('garde la saisie et explique l’erreur quand l’enregistrement échoue', async () => {
    const onSave = vi.fn().mockRejectedValue({ code: '23505' });
    render(<RecipeEditor initial={makeRecipe()} onSave={onSave} onCancel={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vous avez déjà une recette « Chili maison ».');
    expect(screen.getByLabelText('Nom de la recette')).toHaveValue('Chili maison');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('supprime une recette après confirmation', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RecipeEditor initial={makeRecipe()} onSave={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Supprimer la recette' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Confirmer la suppression' });
    expect(dialog).toHaveTextContent('Les repas déjà notés ne changent pas.');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('RecipePortion', () => {
  it('ajoute une part avec l’aperçu exact de la ligne notée', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<RecipePortion recipe={makeRecipe()} defaultMeal="dinner" onAdd={onAdd} onBack={vi.fn()} />);

    expect(screen.getByText('491 kcal')).toBeInTheDocument();
    expect(screen.getByText('Chili maison — 1 part')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dîner' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledWith({
      label: 'Chili maison — 1 part',
      qty_grammes: 450,
      kcal: 491,
      protein_g: 40.2,
      fat_g: 7.4,
      carbs_g: 61,
      fiber_g: 8.3,
      meal_type: 'dinner',
    });
  });

  it('avance par demi-part, entre 0,5 et 20 parts', async () => {
    render(<RecipePortion recipe={makeRecipe()} onAdd={vi.fn()} onBack={vi.fn()} />);
    const user = userEvent.setup();
    const less = screen.getByRole('button', { name: 'Retirer une demi-part' });

    await user.click(less);
    expect(screen.getByText('Chili maison — 0,5 part')).toBeInTheDocument();
    expect(less).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Ajouter une demi-part' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter une demi-part' }));
    expect(screen.getByText('Chili maison — 1,5 part')).toBeInTheDocument();
    expect(screen.getByText('737 kcal')).toBeInTheDocument();
  });

  it('propose les grammes seulement quand le poids cuit est connu', async () => {
    const { unmount } = render(<RecipePortion recipe={makeRecipe({ cooked_weight_g: null })} onAdd={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'En grammes' })).not.toBeInTheDocument();
    unmount();

    render(<RecipePortion recipe={makeRecipe()} onAdd={vi.fn()} onBack={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'En grammes' }));
    const grams = screen.getByLabelText('Quantité (g)');
    expect(grams).toHaveValue(450);
    await user.clear(grams);
    await user.type(grams, '380');
    expect(screen.getByText('415 kcal')).toBeInTheDocument();
    expect(screen.getByText('Chili maison — 380 g')).toBeInTheDocument();
  });
});

describe('RecipesTab', () => {
  it('ajoute une part au repas habituel de la recette', async () => {
    vi.spyOn(recipesService, 'fetchRecipes').mockResolvedValue([makeRecipe()]);
    const onAdd = vi.fn().mockResolvedValue(true);
    render(
      <RecipesTab
        userId="user-1"
        recentEntries={[makeEntry({ label: 'Chili maison — 2 parts', meal_type: 'lunch' })]}
        onAdd={onAdd}
      />
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ajouter 1 part de « Chili maison » au journal' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'Chili maison — 1 part', kcal: 491, meal_type: 'lunch' }));
  });

  it('crée une recette puis revient à la liste avec un message', async () => {
    const fetch = vi.spyOn(recipesService, 'fetchRecipes').mockResolvedValueOnce([]).mockResolvedValue([makeRecipe({ name: 'Dahl' })]);
    const save = vi.spyOn(recipesService, 'saveRecipe').mockResolvedValue(makeRecipe({ name: 'Dahl' }));
    render(<RecipesTab userId="user-1" recentEntries={[]} onAdd={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Nouvelle recette/ }));
    await user.type(screen.getByLabelText('Nom de la recette'), 'Dahl');
    await user.click(screen.getByRole('button', { name: '+ Ajouter un ingrédient' }));
    await user.click(screen.getByRole('button', { name: 'Choisir des lentilles' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter à la recette' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Recette « Dahl » enregistrée.');
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dahl' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: /^Dahl/ })).toBeInTheDocument();
  });

  it('ouvre le choix de la quantité en touchant une recette', async () => {
    vi.spyOn(recipesService, 'fetchRecipes').mockResolvedValue([makeRecipe()]);
    render(<RecipesTab userId="user-1" recentEntries={[]} onAdd={vi.fn()} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /^Chili maison/ }));
    expect(screen.getByRole('heading', { name: 'Chili maison' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Nombre de parts' })).toBeInTheDocument();
  });
});
