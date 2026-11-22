/*
  # Préférences d'affichage de l'utilisateur

  ## Table `user_preferences` (une ligne par utilisateur, facultative)
    - `calorie_display` : « consumed » (consommées / objectif, par défaut) ou
      « remaining » (calories restantes en avant).
    - `macro_display` : « grams » (g consommés / objectif, par défaut) ou
      « percent » (pourcentage de l'objectif atteint).
    - `meal_label_*` : nom personnalisé d'un repas (NULL = nom par défaut).
    - `hidden_meals` : repas masqués dans les choix de saisie (au moins un
      repas reste visible ; les entrées existantes restent affichées).
    Sans ligne, l'application utilise les valeurs par défaut.

  ## Sécurité
    - RLS : chacun ne lit et ne modifie que ses préférences.
    - Supprimées avec le profil (cascade), donc avec le compte.
*/

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  calorie_display text NOT NULL DEFAULT 'consumed'
    CHECK (calorie_display IN ('consumed', 'remaining')),
  macro_display text NOT NULL DEFAULT 'grams'
    CHECK (macro_display IN ('grams', 'percent')),
  meal_label_breakfast text CHECK (char_length(btrim(meal_label_breakfast)) BETWEEN 1 AND 30),
  meal_label_lunch text CHECK (char_length(btrim(meal_label_lunch)) BETWEEN 1 AND 30),
  meal_label_dinner text CHECK (char_length(btrim(meal_label_dinner)) BETWEEN 1 AND 30),
  meal_label_snack text CHECK (char_length(btrim(meal_label_snack)) BETWEEN 1 AND 30),
  hidden_meals text[] NOT NULL DEFAULT '{}'
    CHECK (
      hidden_meals <@ ARRAY['breakfast', 'lunch', 'dinner', 'snack']::text[]
      AND cardinality(hidden_meals) < 4
    ),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;
CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
