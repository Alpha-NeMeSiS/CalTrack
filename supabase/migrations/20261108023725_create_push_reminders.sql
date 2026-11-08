/*
  # Rappels par notifications push

  ## Table `push_subscriptions` (un abonnement par appareil / navigateur)
    - endpoint, p256dh, auth : abonnement Web Push du navigateur.
    - RLS : chacun ne voit et ne supprime que ses abonnements.
    - Enregistrement par la fonction `save_push_subscription` (un même
      navigateur peut changer de compte : l'abonnement est alors rattaché au
      compte connecté).

  ## Colonnes de `user_preferences`
    - reminder_weigh_in_time / reminder_log_time : heure locale du rappel
      (NULL = rappel désactivé).
    - timezone : fuseau IANA de l'utilisateur (ex. Europe/Paris).
    - reminder_*_sent_on : date locale du dernier envoi (un rappel par jour).

  ## Fonction `claim_due_reminders(now)` (réservée au rôle service_role)
    Appelée toutes les 15 min par l'Edge Function send-reminders : renvoie les
    rappels à envoyer et les marque comme envoyés (sans doublon si deux
    exécutions se chevauchent). Un rappel est dû dans l'heure qui suit l'heure
    choisie, sauf si l'action est déjà faite :
      - pesée : aucune pesée enregistrée ce jour-là ;
      - journal : aucun aliment saisi au dîner ce jour-là.
*/

-- 1. Abonnements
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 2048),
  p256dh text NOT NULL CHECK (char_length(p256dh) BETWEEN 40 AND 200),
  auth text NOT NULL CHECK (char_length(auth) BETWEEN 10 AND 100),
  user_agent text CHECK (char_length(user_agent) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 2. Enregistrement d'un abonnement pour l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (current_user_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        created_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;

-- 3. Réglages des rappels
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS reminder_weigh_in_time time,
  ADD COLUMN IF NOT EXISTS reminder_log_time time,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris',
  ADD COLUMN IF NOT EXISTS reminder_weigh_in_sent_on date,
  ADD COLUMN IF NOT EXISTS reminder_log_sent_on date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_timezone_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE user_preferences
      ADD CONSTRAINT user_preferences_timezone_check CHECK (char_length(timezone) BETWEEN 1 AND 64);
  END IF;
END $$;

-- 4. Rappels à envoyer (et marquage « envoyé »)
CREATE OR REPLACE FUNCTION public.claim_due_reminders(p_now timestamptz DEFAULT now())
RETURNS TABLE (user_id uuid, kind text, local_date date, entry_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH prefs AS (
    SELECT
      p.user_id,
      p.reminder_weigh_in_time,
      p.reminder_log_time,
      p.reminder_weigh_in_sent_on,
      p.reminder_log_sent_on,
      (p_now AT TIME ZONE tz.name) AS local_ts
    FROM public.user_preferences p
    -- Fuseau inconnu : utilisateur ignoré (pas d'erreur pour les autres)
    JOIN pg_catalog.pg_timezone_names tz ON tz.name = p.timezone
    WHERE (p.reminder_weigh_in_time IS NOT NULL OR p.reminder_log_time IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = p.user_id)
  ),
  due AS (
    SELECT pr.user_id, 'weigh_in'::text AS kind, pr.local_ts::date AS local_date
    FROM prefs pr
    WHERE pr.reminder_weigh_in_time IS NOT NULL
      AND pr.local_ts - (pr.local_ts::date + pr.reminder_weigh_in_time) >= interval '0'
      AND pr.local_ts - (pr.local_ts::date + pr.reminder_weigh_in_time) < interval '1 hour'
      AND (pr.reminder_weigh_in_sent_on IS NULL OR pr.reminder_weigh_in_sent_on < pr.local_ts::date)
      AND NOT EXISTS (
        SELECT 1 FROM public.weight_logs w WHERE w.user_id = pr.user_id AND w.date = pr.local_ts::date
      )
    UNION ALL
    SELECT pr.user_id, 'log'::text, pr.local_ts::date
    FROM prefs pr
    WHERE pr.reminder_log_time IS NOT NULL
      AND pr.local_ts - (pr.local_ts::date + pr.reminder_log_time) >= interval '0'
      AND pr.local_ts - (pr.local_ts::date + pr.reminder_log_time) < interval '1 hour'
      AND (pr.reminder_log_sent_on IS NULL OR pr.reminder_log_sent_on < pr.local_ts::date)
      AND NOT EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.user_id = pr.user_id AND e.date = pr.local_ts::date AND e.meal_type = 'dinner'
      )
  ),
  -- Marquage : la condition est revérifiée ligne verrouillée, donc deux
  -- exécutions simultanées ne réclament pas le même rappel
  claimed_weigh_in AS (
    UPDATE public.user_preferences up
    SET reminder_weigh_in_sent_on = d.local_date
    FROM due d
    WHERE d.kind = 'weigh_in'
      AND up.user_id = d.user_id
      AND (up.reminder_weigh_in_sent_on IS NULL OR up.reminder_weigh_in_sent_on < d.local_date)
    RETURNING up.user_id
  ),
  claimed_log AS (
    UPDATE public.user_preferences up
    SET reminder_log_sent_on = d.local_date
    FROM due d
    WHERE d.kind = 'log'
      AND up.user_id = d.user_id
      AND (up.reminder_log_sent_on IS NULL OR up.reminder_log_sent_on < d.local_date)
    RETURNING up.user_id
  )
  SELECT
    d.user_id,
    d.kind,
    d.local_date,
    (SELECT count(*)::integer FROM public.entries e WHERE e.user_id = d.user_id AND e.date = d.local_date)
  FROM due d
  WHERE (d.kind = 'weigh_in' AND d.user_id IN (SELECT c.user_id FROM claimed_weigh_in c))
     OR (d.kind = 'log' AND d.user_id IN (SELECT c.user_id FROM claimed_log c));
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminders(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_due_reminders(timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.claim_due_reminders(timestamptz) FROM authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_due_reminders(timestamptz) TO service_role;
  END IF;
END $$;
