-- Recettes : enregistrement atomique (save_recipe), contraintes, isolation
-- entre comptes (RLS) et suppression des ingrédients avec la recette.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

-- Ingrédients de la recette de référence (chili maison, 4 parts)
CREATE TEMP TABLE chili AS SELECT $json$[
  {"label": "Haricots rouges, cuits", "qty_g": 400, "kcal_per_100g": 115, "protein_g": 8.7, "fat_g": 0.5, "carbs_g": 15, "fiber_g": 6.5},
  {"label": "Bœuf haché 5 %, cru", "qty_g": 500, "kcal_per_100g": 125, "protein_g": 21, "fat_g": 5, "carbs_g": 0, "fiber_g": 0},
  {"label": "Tomates concassées", "qty_g": 400, "kcal_per_100g": 25, "protein_g": 1.2, "fat_g": 0.2, "carbs_g": 4, "fiber_g": 1.2},
  {"label": "Riz blanc, cuit", "qty_g": 600, "kcal_per_100g": 130, "protein_g": 2.7, "fat_g": 0.3, "carbs_g": 28, "fiber_g": 0.4}
]$json$::jsonb AS ingredients;
GRANT SELECT ON chili TO authenticated;

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

-- Création
CREATE TEMP TABLE created AS
  SELECT * FROM public.save_recipe(NULL, '  Chili maison  ', 4, 1800, (SELECT ingredients FROM chili));

DO $$
DECLARE
  v_id uuid := (SELECT id FROM created);
BEGIN
  PERFORM test.ok((SELECT user_id FROM created) = auth.uid(), 'recette créée pour l''utilisateur connecté');
  PERFORM test.ok((SELECT name FROM created) = 'Chili maison', 'nom enregistré sans espaces autour');
  PERFORM test.ok((SELECT count(*) FROM public.recipe_ingredients WHERE recipe_id = v_id) = 4, '4 ingrédients enregistrés');
  PERFORM test.ok(
    (SELECT array_agg(label ORDER BY position) FROM public.recipe_ingredients WHERE recipe_id = v_id)
      = ARRAY['Haricots rouges, cuits', 'Bœuf haché 5 %, cru', 'Tomates concassées', 'Riz blanc, cuit'],
    'ingrédients dans l''ordre du tableau (positions 0 à 3)'
  );
END $$;

-- Mise à jour : les ingrédients sont remplacés
DO $$
DECLARE
  v_id uuid := (SELECT id FROM created);
  v_recipe public.recipes;
BEGIN
  SELECT * INTO v_recipe FROM public.save_recipe(
    v_id, 'Chili maison', 6, NULL,
    '[{"label": "Riz blanc, cuit", "qty_g": 900, "kcal_per_100g": 130, "protein_g": 2.7, "fat_g": 0.3, "carbs_g": 28}]'::jsonb
  );
  PERFORM test.ok(v_recipe.id = v_id, 'mise à jour de la même recette');
  PERFORM test.ok(v_recipe.servings = 6 AND v_recipe.cooked_weight_g IS NULL, 'parts et poids cuit mis à jour');
  PERFORM test.ok((SELECT count(*) FROM public.recipe_ingredients WHERE recipe_id = v_id) = 1, 'ingrédients remplacés');
  PERFORM test.ok((SELECT fiber_g FROM public.recipe_ingredients WHERE recipe_id = v_id) = 0, 'fibres à 0 par défaut');
END $$;

-- Nombre d'ingrédients : de 1 à 50, sinon rien n'est enregistré
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'Vide', 2, NULL, '[]'::jsonb) $$, '22023', 'recette sans ingrédient refusée');
SELECT test.raises(
  $$ SELECT public.save_recipe(NULL, 'Énorme', 2, NULL,
       (SELECT jsonb_agg(jsonb_build_object('label', 'Ingrédient ' || i, 'qty_g', 10, 'kcal_per_100g', 100, 'protein_g', 1, 'fat_g', 1, 'carbs_g', 1))
        FROM generate_series(1, 51) AS i)) $$,
  '22023', 'plus de 50 ingrédients refusés'
);
SELECT test.raises(
  $$ SELECT public.save_recipe(NULL, 'Quantité nulle', 2, NULL,
       '[{"label": "Riz", "qty_g": 0, "kcal_per_100g": 130, "protein_g": 2.7, "fat_g": 0.3, "carbs_g": 28}]'::jsonb) $$,
  '23514', 'quantité d''ingrédient nulle refusée'
);
SELECT test.ok(
  (SELECT count(*) FROM public.recipes WHERE user_id = auth.uid()) = 1,
  'aucune recette enregistrée à moitié après les refus'
);

-- Contraintes de la recette
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'chili MAISON', 4, NULL, (SELECT ingredients FROM chili)) $$, '23505', 'nom déjà utilisé (sans tenir compte de la casse)');
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'Zéro part', 0, NULL, (SELECT ingredients FROM chili)) $$, '23514', '0 part refusée');
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'Trop de parts', 51, NULL, (SELECT ingredients FROM chili)) $$, '23514', 'plus de 50 parts refusées');
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'Poids nul', 4, 0, (SELECT ingredients FROM chili)) $$, '23514', 'poids cuit nul refusé');
SELECT test.raises($$ SELECT public.save_recipe(NULL, '   ', 4, NULL, (SELECT ingredients FROM chili)) $$, '23514', 'nom vide refusé');

-- Isolation : Bob ne voit ni ne modifie la recette d'Alice
SELECT test.login(test.uid('bob'));
SELECT test.ok((SELECT count(*) FROM public.recipes) = 0, 'Bob ne voit pas les recettes d''Alice');
SELECT test.ok((SELECT count(*) FROM public.recipe_ingredients) = 0, 'Bob ne voit pas les ingrédients d''Alice');
SELECT test.ok(test.affected(format('UPDATE public.recipes SET name = %L', 'Volé')) = 0, 'Bob ne modifie pas les recettes d''Alice');
SELECT test.ok(test.affected('DELETE FROM public.recipe_ingredients') = 0, 'Bob ne supprime pas les ingrédients d''Alice');
SELECT test.raises(
  format($$ SELECT public.save_recipe(%L, 'Volé', 1, NULL, (SELECT ingredients FROM chili)) $$, (SELECT id FROM created)),
  'P0002', 'save_recipe sur la recette d''un autre compte : introuvable'
);
SELECT test.raises(
  format($$ INSERT INTO public.recipe_ingredients (recipe_id, position, label, qty_g, kcal_per_100g, protein_g, fat_g, carbs_g)
            VALUES (%L, 9, 'Intrus', 10, 100, 1, 1, 1) $$, (SELECT id FROM created)),
  '42501', 'Bob ne peut pas ajouter d''ingrédient à la recette d''Alice'
);

-- Suppression : les ingrédients suivent
SELECT test.login(test.uid('alice'));
DELETE FROM public.recipes WHERE id = (SELECT id FROM created);
SELECT test.ok((SELECT count(*) FROM public.recipe_ingredients WHERE recipe_id = (SELECT id FROM created)) = 0, 'ingrédients supprimés avec la recette');

-- Sans session : fonction refusée aux visiteurs
RESET ROLE;
SET ROLE anon;
SELECT test.raises($$ SELECT public.save_recipe(NULL, 'Anonyme', 1, NULL, '[]'::jsonb) $$, '42501', 'save_recipe refusée aux visiteurs non connectés');
RESET ROLE;
