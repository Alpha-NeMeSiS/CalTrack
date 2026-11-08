/*
  # Suivi de l'eau

  1. water_logs : une ligne par prise d'eau (1 à 3 000 ml), pour un jour du
     journal. « Annuler le dernier » supprime la prise la plus récente ; une
     prise ne se modifie pas. Accès limité à ses propres prises (RLS),
     supprimées avec le compte (cascade).
  2. user_preferences.water_goal_ml : objectif manuel (500 à 6 000 ml) ;
     NULL = objectif automatique calculé d'après le poids (30 ml/kg).
*/

CREATE TABLE IF NOT EXISTS water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount_ml integer NOT NULL CHECK (amount_ml BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON water_logs (user_id, date);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own water logs" ON water_logs;
CREATE POLICY "Users can read own water logs"
  ON water_logs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own water logs" ON water_logs;
CREATE POLICY "Users can insert own water logs"
  ON water_logs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own water logs" ON water_logs;
CREATE POLICY "Users can delete own water logs"
  ON water_logs FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON water_logs TO authenticated;

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS water_goal_ml integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_water_goal_ml_check' AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_water_goal_ml_check CHECK (water_goal_ml IS NULL OR water_goal_ml BETWEEN 500 AND 6000);
  END IF;
END $$;
