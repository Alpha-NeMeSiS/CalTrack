/*
  # Recettes : plats maison partagés en parts

  1. recipes : nom (unique par compte, sans tenir compte de la casse),
     nombre de parts (1 à 50), poids cuit total facultatif (1 à 20 000 g).
  2. recipe_ingredients : ingrédients d'une recette, avec une copie de leurs
     valeurs pour 100 g (comme les favoris) ; supprimés avec la recette.
  3. save_recipe(...) : crée ou met à jour une recette et remplace ses
     ingrédients en une seule transaction (1 à 50 ingrédients) ; rien n'est
     enregistré en cas d'erreur. Exécutée avec les droits de l'utilisateur
     (RLS appliquée).

  Accès limité à ses propres recettes (RLS) ; tout est supprimé avec le
  compte (cascade depuis profiles).
*/

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  servings integer NOT NULL CHECK (servings BETWEEN 1 AND 50),
  cooked_weight_g numeric CHECK (cooked_weight_g IS NULL OR (cooked_weight_g >= 1 AND cooked_weight_g <= 20000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recipes_user_name_key ON recipes (user_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position >= 0),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  qty_g numeric NOT NULL CHECK (qty_g > 0 AND qty_g <= 5000),
  kcal_per_100g numeric NOT NULL CHECK (kcal_per_100g BETWEEN 0 AND 900),
  protein_g numeric NOT NULL CHECK (protein_g BETWEEN 0 AND 100),
  fat_g numeric NOT NULL CHECK (fat_g BETWEEN 0 AND 100),
  carbs_g numeric NOT NULL CHECK (carbs_g BETWEEN 0 AND 100),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON recipe_ingredients (recipe_id);

-- Accès : ses propres recettes ; les ingrédients via leur recette
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own recipes" ON recipes;
CREATE POLICY "Users can read own recipes"
  ON recipes FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
CREATE POLICY "Users can insert own recipes"
  ON recipes FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
CREATE POLICY "Users can update own recipes"
  ON recipes FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
CREATE POLICY "Users can delete own recipes"
  ON recipes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can read own recipe ingredients"
  ON recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can insert own recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can insert own recipe ingredients"
  ON recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update own recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can update own recipe ingredients"
  ON recipe_ingredients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can delete own recipe ingredients" ON recipe_ingredients;
CREATE POLICY "Users can delete own recipe ingredients"
  ON recipe_ingredients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = (SELECT auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON recipes, recipe_ingredients TO authenticated;

-- Enregistrement atomique d'une recette et de ses ingrédients
CREATE OR REPLACE FUNCTION public.save_recipe(
  p_id uuid,
  p_name text,
  p_servings integer,
  p_cooked_weight_g numeric,
  p_ingredients jsonb
) RETURNS public.recipes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_recipe public.recipes;
  v_count integer := CASE WHEN jsonb_typeof(p_ingredients) = 'array' THEN jsonb_array_length(p_ingredients) ELSE 0 END;
BEGIN
  IF v_count < 1 OR v_count > 50 THEN
    RAISE EXCEPTION 'recipe_ingredients_count' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.recipes (user_id, name, servings, cooked_weight_g)
    VALUES (auth.uid(), btrim(p_name), p_servings, p_cooked_weight_g)
    RETURNING * INTO v_recipe;
  ELSE
    UPDATE public.recipes
       SET name = btrim(p_name), servings = p_servings, cooked_weight_g = p_cooked_weight_g, updated_at = now()
     WHERE id = p_id
    RETURNING * INTO v_recipe;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'recipe_not_found' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe.id;
  END IF;

  INSERT INTO public.recipe_ingredients (recipe_id, position, label, qty_g, kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g)
  SELECT v_recipe.id, (item.ordinality - 1)::smallint, btrim(item.value ->> 'label'),
         (item.value ->> 'qty_g')::numeric, (item.value ->> 'kcal_per_100g')::numeric,
         (item.value ->> 'protein_g')::numeric, (item.value ->> 'fat_g')::numeric,
         (item.value ->> 'carbs_g')::numeric, COALESCE((item.value ->> 'fiber_g')::numeric, 0)
  FROM jsonb_array_elements(p_ingredients) WITH ORDINALITY AS item(value, ordinality);

  RETURN v_recipe;
END $$;

REVOKE ALL ON FUNCTION public.save_recipe(uuid, text, integer, numeric, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe(uuid, text, integer, numeric, jsonb) TO authenticated;
