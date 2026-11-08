/*
  # Mesures détaillées du profil (facultatives)

  Valeurs d'une balance impédancemètre ou d'un bilan, saisies dans
  « Mon profil → Données corporelles → Mesures détaillées » :

  - body_water_pct : taux d'eau (%), 30 à 80 ;
  - visceral_fat_rating : indice de graisse viscérale (entier, 1 à 59),
    indicateur de santé seulement ;
  - muscle_mass_kg : masse musculaire (kg), 10 à 150 ;
  - bone_mass_kg : masse osseuse (kg), 0,5 à 10.

  Elles permettent d'estimer la masse maigre quand le taux de masse grasse
  n'est pas connu, et donc d'utiliser la formule de Katch-McArdle (voir
  estimateLeanMass dans src/utils/calculations.ts). Toutes sont NULL par
  défaut : les politiques RLS existantes de profiles s'appliquent.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS body_water_pct numeric(4,1),
  ADD COLUMN IF NOT EXISTS visceral_fat_rating smallint,
  ADD COLUMN IF NOT EXISTS muscle_mass_kg numeric(5,1),
  ADD COLUMN IF NOT EXISTS bone_mass_kg numeric(4,1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_body_water_pct_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_body_water_pct_check
      CHECK (body_water_pct IS NULL OR body_water_pct BETWEEN 30 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_visceral_fat_rating_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_visceral_fat_rating_check
      CHECK (visceral_fat_rating IS NULL OR visceral_fat_rating BETWEEN 1 AND 59);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_muscle_mass_kg_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_muscle_mass_kg_check
      CHECK (muscle_mass_kg IS NULL OR muscle_mass_kg BETWEEN 10 AND 150);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bone_mass_kg_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_bone_mass_kg_check
      CHECK (bone_mass_kg IS NULL OR bone_mass_kg BETWEEN 0.5 AND 10);
  END IF;
END $$;

COMMENT ON COLUMN profiles.body_water_pct IS 'Taux d''eau corporelle (%), facultatif';
COMMENT ON COLUMN profiles.visceral_fat_rating IS 'Indice de graisse viscérale (1-59), facultatif, non utilisé dans les calculs';
COMMENT ON COLUMN profiles.muscle_mass_kg IS 'Masse musculaire (kg), facultatif';
COMMENT ON COLUMN profiles.bone_mass_kg IS 'Masse osseuse (kg), facultatif';
