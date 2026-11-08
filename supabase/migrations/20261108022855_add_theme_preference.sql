/*
  # Thème de l'application

  ## user_preferences.theme
    - « system » (par défaut) : suit le réglage clair / sombre de l'appareil ;
    - « light » / « dark » : thème forcé.
    Le choix suit le compte sur tous les appareils.
*/

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_theme_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_theme_check CHECK (theme IN ('system', 'light', 'dark'));
  END IF;
END $$;
