/*
  # Réconciliation du schéma avec la production

  ## Contexte

  L'historique des migrations de la base de production ne reflète pas son
  schéma réel : certaines modifications ont été faites hors migrations
  (éditeur SQL), après les migrations 20251105 à 20251205. Rejouer toutes les
  migrations sur une base neuve (environnement local, branche Supabase,
  nouveau projet) donnait donc un schéma DIFFÉRENT de la production :

  - `foods.category` existait (absente en production, inutilisée par l'app) ;
  - `password_reset_tokens` gardait la version de 20251106 : colonne `email`,
    `user_id` facultatif lié à `profiles`, index `expires_at`, et surtout une
    politique permettant à N'IMPORTE QUEL visiteur anonyme d'insérer des
    jetons de réinitialisation (« Allow unauthenticated token creation »).

  ## Changements

  Cette migration aligne une base neuve sur la production. Toutes les
  opérations sont conditionnelles : appliquée à la production, elle ne
  modifie rien (vérifié par empreinte du schéma).

  1. `foods` : suppression de `category` si elle existe.
  2. `password_reset_tokens` : définition de production (migration 20251203191737)
     - suppression des deux anciennes politiques (dont l'INSERT anonyme) ;
     - suppression de l'index `expires_at` et de la colonne `email` ;
     - `user_id` obligatoire et lié à `auth.users`.
*/

-- 1. foods.category : absente en production, inutilisée par l'application
ALTER TABLE foods DROP COLUMN IF EXISTS category;

-- 2. password_reset_tokens : aligner sur la définition de production
DROP POLICY IF EXISTS "Allow unauthenticated token creation via edge function" ON password_reset_tokens;
DROP POLICY IF EXISTS "Users can view their own reset tokens" ON password_reset_tokens;
DROP INDEX IF EXISTS idx_password_reset_tokens_expires_at;
ALTER TABLE password_reset_tokens DROP COLUMN IF EXISTS email;

-- Un jeton sans utilisateur est inutilisable : nécessaire avant NOT NULL
-- (aucune ligne concernée en production, où user_id est déjà obligatoire)
DELETE FROM password_reset_tokens WHERE user_id IS NULL;
ALTER TABLE password_reset_tokens ALTER COLUMN user_id SET NOT NULL;

-- Clé étrangère vers auth.users (et non profiles) comme en production
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_user_id_fkey'
      AND conrelid = 'public.password_reset_tokens'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE password_reset_tokens DROP CONSTRAINT password_reset_tokens_user_id_fkey;
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
