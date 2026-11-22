/*
  # Bibliothèque d'aliments : mes aliments (code-barres) et favoris

  1. foods (aliments personnels, user_id = l'utilisateur) :
     - barcode : code-barres GTIN facultatif (8 à 14 chiffres), pour
       retrouver au scan un produit créé à la main ;
     - un même code-barres au plus une fois par utilisateur ;
     - nom non vide, 120 caractères au plus.

  2. favorite_foods : aliments favoris, ajoutables en un tap depuis la
     recherche. Chaque favori garde ses valeurs pour 100 g (copie au moment
     de l'ajout) et la quantité habituelle ; un même nom au plus une fois
     par utilisateur. Accès limité à ses propres favoris (RLS), supprimés
     avec le compte (cascade).
*/

-- 1. Aliments personnels : code-barres et nom
ALTER TABLE foods ADD COLUMN IF NOT EXISTS barcode text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'foods_barcode_check' AND conrelid = 'public.foods'::regclass) THEN
    ALTER TABLE foods ADD CONSTRAINT foods_barcode_check CHECK (barcode IS NULL OR barcode ~ '^[0-9]{8,14}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'foods_name_length_check' AND conrelid = 'public.foods'::regclass) THEN
    ALTER TABLE foods ADD CONSTRAINT foods_name_length_check CHECK (char_length(btrim(name)) BETWEEN 1 AND 120);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS foods_user_barcode_key
  ON foods (user_id, barcode)
  WHERE user_id IS NOT NULL AND barcode IS NOT NULL;

-- 2. Favoris
CREATE TABLE IF NOT EXISTS favorite_foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 160),
  kcal_per_100g numeric NOT NULL CHECK (kcal_per_100g BETWEEN 0 AND 900),
  protein_g numeric NOT NULL CHECK (protein_g BETWEEN 0 AND 100),
  fat_g numeric NOT NULL CHECK (fat_g BETWEEN 0 AND 100),
  carbs_g numeric NOT NULL CHECK (carbs_g BETWEEN 0 AND 100),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g BETWEEN 0 AND 100),
  default_qty_g numeric NOT NULL DEFAULT 100 CHECK (default_qty_g > 0 AND default_qty_g <= 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_foods_user_label_key
  ON favorite_foods (user_id, lower(btrim(label)));

ALTER TABLE favorite_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own favorite foods" ON favorite_foods;
CREATE POLICY "Users can read own favorite foods"
  ON favorite_foods FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own favorite foods" ON favorite_foods;
CREATE POLICY "Users can insert own favorite foods"
  ON favorite_foods FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own favorite foods" ON favorite_foods;
CREATE POLICY "Users can update own favorite foods"
  ON favorite_foods FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own favorite foods" ON favorite_foods;
CREATE POLICY "Users can delete own favorite foods"
  ON favorite_foods FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
