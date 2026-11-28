-- Migrations issues de l'audit du 27/11/2026 (docs/AUDIT-2026-11-27.md).
-- A-02 : photos de profil privées · A-16 : index de clés étrangères
-- A-17 : table password_reset_tokens supprimée · A-18 : adresses push limitées

SELECT test.create_user('alice');
SELECT test.create_user('bob');

-- ---------------------------------------------------------------------------
-- A-17 : la table de jetons de réinitialisation n'existe plus
-- ---------------------------------------------------------------------------
SELECT test.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_tokens'
  ),
  'la table password_reset_tokens a été supprimée'
);

-- ---------------------------------------------------------------------------
-- A-16 : les deux clés étrangères sont couvertes par un index
-- ---------------------------------------------------------------------------
SELECT test.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'entries_food_id_idx'),
  'entries.food_id est indexée'
);

SELECT test.ok(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'daily_targets_goal_id_idx'),
  'daily_targets.goal_id est indexée'
);

-- ---------------------------------------------------------------------------
-- A-04 : plus aucune politique n'appelle auth.uid() hors sous-requête, et
-- profiles n'a plus qu'une seule politique de lecture
-- ---------------------------------------------------------------------------
-- Postgres affiche la bonne forme « ( SELECT auth.uid() AS uid) » : on ne peut
-- donc pas chercher le caractère qui précède. On compte les occurrences de
-- `auth.uid()` et celles précédées de `SELECT ` : tout écart signale un appel
-- évalué ligne par ligne.
CREATE OR REPLACE FUNCTION test.bare_auth_uid_count(p_expression text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT
    (length(coalesce(p_expression, '')) - length(replace(coalesce(p_expression, ''), 'auth.uid()', ''))) / length('auth.uid()')
    - (length(coalesce(p_expression, '')) - length(replace(coalesce(p_expression, ''), 'SELECT auth.uid()', ''))) / length('SELECT auth.uid()');
$$;

SELECT test.ok(
  (
    SELECT coalesce(sum(test.bare_auth_uid_count(qual) + test.bare_auth_uid_count(with_check)), 0)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'goals', 'daily_targets', 'foods', 'entries', 'weight_logs')
  ) = 0,
  'aucune politique n''évalue auth.uid() ligne par ligne'
);

SELECT test.ok(
  (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  ) = 1,
  'profiles n''a plus qu''une seule politique de lecture (doublon supprimé)'
);

-- L'isolation reste intacte après la réécriture des politiques
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;
INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g)
VALUES (auth.uid(), '2026-11-27', 'Riz', 200, 260, 5, 1, 56);
RESET ROLE;

SELECT test.login(test.uid('bob'));
SET ROLE authenticated;
SELECT test.ok(
  (SELECT count(*) FROM public.entries) = 0,
  'Bob ne voit toujours aucune entrée d''Alice'
);
SELECT test.ok(
  (SELECT count(*) FROM public.profiles) = 1,
  'Bob ne voit toujours que son propre profil'
);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- A-18 : seules les adresses des services de push sont acceptées
-- ---------------------------------------------------------------------------
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

SELECT public.save_push_subscription(
  'https://fcm.googleapis.com/fcm/send/abc123', repeat('k', 60), repeat('a', 16), 'Chrome'
);
SELECT test.ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = auth.uid()) = 1,
  'une adresse Firebase (Chrome, Android) est acceptée'
);

SELECT public.save_push_subscription(
  'https://updates.push.services.mozilla.com/wpush/v2/xyz', repeat('k', 60), repeat('a', 16), 'Firefox'
);
SELECT test.ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = auth.uid()) = 2,
  'une adresse Mozilla (Firefox) est acceptée'
);

SELECT public.save_push_subscription(
  'https://web.push.apple.com/QWERTY', repeat('k', 60), repeat('a', 16), 'Safari'
);
SELECT test.ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = auth.uid()) = 3,
  'une adresse Apple (Safari, iOS) est acceptée'
);

-- Un hôte quelconque est refusé : l'Edge Function ne doit pas pouvoir être
-- amenée à écrire vers n'importe quelle adresse.
SELECT test.raises(
  $$ SELECT public.save_push_subscription('https://site-malveillant.example/collecte', repeat('k', 60), repeat('a', 16), 'X') $$,
  '23514',
  'une adresse qui n''est pas un service de push est refusée'
);

SELECT test.raises(
  $$ SELECT public.save_push_subscription('http://fcm.googleapis.com/fcm/send/abc', repeat('k', 60), repeat('a', 16), 'X') $$,
  '23514',
  'une adresse non chiffrée (http) est refusée'
);

-- Contournements qui passaient avec LIKE (« % » accepte « / ») : refusés
SELECT test.raises(
  $$ SELECT public.save_push_subscription('https://site-malveillant.example/a.notify.windows.com/x', repeat('k', 60), repeat('a', 16), 'X') $$,
  '23514',
  'un faux sous-domaine Windows caché dans le chemin est refusé'
);

SELECT test.raises(
  $$ SELECT public.save_push_subscription('https://site-malveillant.example/x.push.apple.com/y', repeat('k', 60), repeat('a', 16), 'X') $$,
  '23514',
  'un faux sous-domaine Apple caché dans le chemin est refusé'
);

SELECT test.raises(
  $$ SELECT public.save_push_subscription('https://fcm.googleapis.com.site-malveillant.example/x', repeat('k', 60), repeat('a', 16), 'X') $$,
  '23514',
  'un domaine qui commence comme Firebase est refusé'
);

-- Un vrai sous-domaine Windows reste accepté
SELECT public.save_push_subscription(
  'https://wns2-par02p.notify.windows.com/w/?token=abc', repeat('k', 60), repeat('a', 16), 'Edge'
);
SELECT test.ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE endpoint LIKE 'https://wns2-par02p.notify.windows.com/%') = 1,
  'une adresse Windows (WNS) est acceptée'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- A-02 : les photos de profil ne sont plus publiques
-- ---------------------------------------------------------------------------
-- La conversion URL → chemin est faite par la migration ; on vérifie ici
-- l'expression utilisée, sur une URL réaliste (avec paramètre de cache).
SELECT test.ok(
  split_part(
    substring('https://ieri.supabase.co/storage/v1/object/public/profile-pictures/abc-123/avatar-1732.jpg?v=2'
              from '/object/public/profile-pictures/(.*)$'),
    '?', 1) = 'abc-123/avatar-1732.jpg',
  'une URL publique est convertie en chemin, sans le paramètre de cache'
);
SELECT test.ok(
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE profile_picture_url LIKE '%/object/public/%'),
  'aucune URL publique ne subsiste dans les profils'
);

SELECT test.ok(
  (SELECT public FROM storage.buckets WHERE id = 'profile-pictures') = false,
  'le seau profile-pictures n''est plus public'
);

SELECT test.ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Everyone can view profile pictures'
  ),
  'la politique de lecture sans restriction a été supprimée'
);

SELECT test.ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can view own profile pictures'
      AND 'authenticated' = ANY (roles)
  ),
  'la lecture est réservée à l''utilisateur connecté, sur son dossier'
);

SELECT test.ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own profile pictures'
  ),
  'la politique de suppression, qui manquait, existe désormais'
);

-- Isolation réelle : Bob ne lit pas le fichier d'Alice
INSERT INTO storage.objects (bucket_id, name)
VALUES ('profile-pictures', test.uid('alice')::text || '/avatar-1.jpg');

SELECT test.login(test.uid('bob'));
SET ROLE authenticated;
SELECT test.ok(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'profile-pictures') = 0,
  'Bob ne voit pas la photo de profil d''Alice'
);
RESET ROLE;

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;
SELECT test.ok(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'profile-pictures') = 1,
  'Alice voit sa propre photo'
);
RESET ROLE;
