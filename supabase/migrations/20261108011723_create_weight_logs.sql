/*
  # Journal de pesées

  ## Nouvelle table `weight_logs`
    - `id` (uuid, clé primaire)
    - `user_id` (uuid, lié à profiles, suppression en cascade)
    - `date` (date) : une pesée par jour et par utilisateur (UNIQUE)
    - `weight_kg` (numeric, 0 < x <= 500, comme profiles.poids_kg)
    - `created_at` (timestamptz)

  ## Sécurité
    - RLS activée : chaque utilisateur ne voit et ne modifie que ses pesées.

  ## Reprise de l'existant
    - Pour chaque objectif actif ayant un poids de départ : pesée à sa date de début.
    - Pour chaque profil : pesée du poids actuel à la date de dernière mise à jour.
    Les utilisateurs existants démarrent ainsi avec un historique minimal.

  Migration idempotente.
*/

CREATE TABLE IF NOT EXISTS weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 500),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weight logs" ON weight_logs;
CREATE POLICY "Users can view own weight logs"
  ON weight_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own weight logs" ON weight_logs;
CREATE POLICY "Users can insert own weight logs"
  ON weight_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own weight logs" ON weight_logs;
CREATE POLICY "Users can update own weight logs"
  ON weight_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own weight logs" ON weight_logs;
CREATE POLICY "Users can delete own weight logs"
  ON weight_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Reprise : poids de départ des objectifs actifs
INSERT INTO weight_logs (user_id, date, weight_kg)
SELECT g.user_id, g.start_date, g.start_weight_kg
FROM goals AS g
WHERE g.is_active = true
  AND g.start_date IS NOT NULL
  AND g.start_weight_kg IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;

-- Reprise : poids actuel des profils
INSERT INTO weight_logs (user_id, date, weight_kg)
SELECT p.id, COALESCE(p.updated_at, p.created_at, now())::date, p.poids_kg
FROM profiles AS p
WHERE p.poids_kg IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;
