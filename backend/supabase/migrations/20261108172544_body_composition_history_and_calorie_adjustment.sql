/*
  # Historique de composition corporelle et ajustement des calories

  1. weight_logs : composition facultative saisie avec la pesée (balance
     impédancemètre), mêmes bornes que le profil (migration 20261108162648) :
     - body_fat_pct : masse grasse (%), 3 à 60 ;
     - muscle_mass_kg : masse musculaire (kg), 10 à 150 ;
     - bone_mass_kg : masse osseuse (kg), 0,5 à 10 ;
     - body_water_pct : eau corporelle (%), 30 à 80 ;
     - visceral_fat_rating : indice de graisse viscérale (entier), 1 à 59.

  2. goals : ajustement des calories proposé d'après la dépense réelle
     (src/utils/calorieAdjustment.ts) et accepté par l'utilisateur :
     - calorie_adjustment_kcal : ajouté aux calories calculées (-1000 à 1000,
       0 par défaut) ;
     - calorie_adjustment_at : date du dernier ajustement (une proposition
       au plus par semaine).

  Les politiques RLS existantes de weight_logs et goals s'appliquent.
*/

ALTER TABLE weight_logs
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric(4,1),
  ADD COLUMN IF NOT EXISTS muscle_mass_kg numeric(5,1),
  ADD COLUMN IF NOT EXISTS bone_mass_kg numeric(4,1),
  ADD COLUMN IF NOT EXISTS body_water_pct numeric(4,1),
  ADD COLUMN IF NOT EXISTS visceral_fat_rating smallint;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS calorie_adjustment_kcal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calorie_adjustment_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_body_fat_pct_check' AND conrelid = 'public.weight_logs'::regclass) THEN
    ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_body_fat_pct_check
      CHECK (body_fat_pct IS NULL OR body_fat_pct BETWEEN 3 AND 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_muscle_mass_kg_check' AND conrelid = 'public.weight_logs'::regclass) THEN
    ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_muscle_mass_kg_check
      CHECK (muscle_mass_kg IS NULL OR muscle_mass_kg BETWEEN 10 AND 150);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_bone_mass_kg_check' AND conrelid = 'public.weight_logs'::regclass) THEN
    ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_bone_mass_kg_check
      CHECK (bone_mass_kg IS NULL OR bone_mass_kg BETWEEN 0.5 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_body_water_pct_check' AND conrelid = 'public.weight_logs'::regclass) THEN
    ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_body_water_pct_check
      CHECK (body_water_pct IS NULL OR body_water_pct BETWEEN 30 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weight_logs_visceral_fat_rating_check' AND conrelid = 'public.weight_logs'::regclass) THEN
    ALTER TABLE weight_logs ADD CONSTRAINT weight_logs_visceral_fat_rating_check
      CHECK (visceral_fat_rating IS NULL OR visceral_fat_rating BETWEEN 1 AND 59);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_calorie_adjustment_kcal_check' AND conrelid = 'public.goals'::regclass) THEN
    ALTER TABLE goals ADD CONSTRAINT goals_calorie_adjustment_kcal_check
      CHECK (calorie_adjustment_kcal BETWEEN -1000 AND 1000);
  END IF;
END $$;

COMMENT ON COLUMN goals.calorie_adjustment_kcal IS 'Ajustement (kcal/j) ajouté aux calories calculées, accepté par l''utilisateur d''après sa dépense réelle';
COMMENT ON COLUMN goals.calorie_adjustment_at IS 'Date du dernier ajustement des calories';
