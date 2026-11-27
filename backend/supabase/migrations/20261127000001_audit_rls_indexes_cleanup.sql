/*
  # Audit du 27/11/2026 : politiques RLS, index et ménage

  Regroupe quatre points de `docs/AUDIT-2026-11-27.md` en une seule migration.
  Aucun changement de comportement pour l'utilisateur : même isolation des
  données, mêmes droits.

  ## A-04 — politiques RLS évaluées une fois par requête
    Les politiques écrites au début du projet utilisent `auth.uid()` directement :
    Postgres le recalcule alors POUR CHAQUE LIGNE. `(SELECT auth.uid())` n'est
    évalué qu'une fois. Les migrations récentes (recettes, eau, préférences)
    utilisent déjà la bonne forme ; celle-ci rattrape les 24 politiques
    signalées par les advisors Supabase.

  ## A-04 bis — doublon sur `profiles`
    Deux politiques SELECT faisaient la même chose (« Users can view own
    profile » et « Users can read own profile »), créées par deux migrations
    différentes. Les deux étaient évaluées à chaque lecture.

  ## A-16 — index manquants sur deux clés étrangères
    Sans index, chaque suppression dans la table parente force un parcours
    complet de la table enfant. `entries` est la table qui grossit le plus.

  ## A-17 — table `password_reset_tokens` supprimée
    Aucune ligne de code ne la lit ni ne l'écrit (vérifié sur frontend,
    backend, e2e et scripts) : la réinitialisation du mot de passe passe
    entièrement par Supabase Auth (`resetPasswordForEmail`).
    ⚠️ Vérifier qu'elle est vide avant d'appliquer :
        SELECT count(*) FROM public.password_reset_tokens;
*/

-- ---------------------------------------------------------------------------
-- A-04 : profiles (une seule politique de lecture)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-04 : goals
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own goals" ON goals;
CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-04 : daily_targets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own targets" ON daily_targets;
CREATE POLICY "Users can view own targets"
  ON daily_targets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own targets" ON daily_targets;
CREATE POLICY "Users can insert own targets"
  ON daily_targets FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own targets" ON daily_targets;
CREATE POLICY "Users can update own targets"
  ON daily_targets FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own targets" ON daily_targets;
CREATE POLICY "Users can delete own targets"
  ON daily_targets FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-04 : foods (les aliments publics restent visibles de tous)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view public foods and own foods" ON foods;
CREATE POLICY "Users can view public foods and own foods"
  ON foods FOR SELECT TO authenticated
  USING (is_public = true OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own foods" ON foods;
CREATE POLICY "Users can insert own foods"
  ON foods FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own foods" ON foods;
CREATE POLICY "Users can update own foods"
  ON foods FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own foods" ON foods;
CREATE POLICY "Users can delete own foods"
  ON foods FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-04 : entries
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own entries" ON entries;
CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own entries" ON entries;
CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own entries" ON entries;
CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own entries" ON entries;
CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-04 : weight_logs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own weight logs" ON weight_logs;
CREATE POLICY "Users can view own weight logs"
  ON weight_logs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own weight logs" ON weight_logs;
CREATE POLICY "Users can insert own weight logs"
  ON weight_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own weight logs" ON weight_logs;
CREATE POLICY "Users can update own weight logs"
  ON weight_logs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own weight logs" ON weight_logs;
CREATE POLICY "Users can delete own weight logs"
  ON weight_logs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- A-16 : index sur les clés étrangères non couvertes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS entries_food_id_idx ON entries (food_id);
CREATE INDEX IF NOT EXISTS daily_targets_goal_id_idx ON daily_targets (goal_id);

-- ---------------------------------------------------------------------------
-- A-17 : table de jetons de réinitialisation, jamais utilisée par le code
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.password_reset_tokens;
