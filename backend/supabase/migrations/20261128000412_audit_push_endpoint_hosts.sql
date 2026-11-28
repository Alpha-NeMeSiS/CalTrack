/*
  # Audit A-18 : l'adresse d'abonnement push doit être un service connu

  ## Le problème
  La seule contrainte était « commence par https:// » :

      CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 2048)

  Un utilisateur connecté pouvait donc enregistrer n'importe quelle adresse, et
  l'Edge Function `send-reminders` lui enverrait des requêtes : l'application
  devenait un petit relais sortant.

  ## Après cette migration
  Seuls les services de push des navigateurs sont acceptés.

  ## ⚠️ Avant d'appliquer
  Vérifier que les abonnements existants passent la nouvelle contrainte, sinon
  la migration échoue :

      SELECT DISTINCT substring(endpoint from '^https://[^/]+') FROM public.push_subscriptions;

  Si un hôte légitime manque à la liste, l'ajouter ici avant d'appliquer.

  ## Note sur la reprise d'abonnement (non corrigée : c'est voulu)
  `save_push_subscription` fait `ON CONFLICT (endpoint) DO UPDATE SET user_id =
  EXCLUDED.user_id`. Qui connaîtrait l'adresse d'un autre appareil pourrait donc
  la rattacher à son compte. C'est le comportement attendu : il permet de
  changer de compte sur un même navigateur. L'adresse est une longue URL non
  devinable, et elle n'est lisible que par son propriétaire (RLS).
*/

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_check;

-- Expression régulière plutôt que LIKE : dans LIKE, « % » accepte aussi « / »,
-- si bien que 'https://%.notify.windows.com/%' laissait passer
-- 'https://site-malveillant.example/a.notify.windows.com/x'. Ici, le nom d'hôte
-- est ancré entre « https:// » et le premier « / », et un sous-domaine ne peut
-- contenir que des lettres, chiffres et tirets. Services acceptés :
--   fcm.googleapis.com                  Chrome, Edge, Android
--   updates.push.services.mozilla.com   Firefox
--   *.push.apple.com                    Safari, iOS (web.push.apple.com…)
--   *.notify.windows.com                Windows (WNS)
-- Le motif est écrit en UNE chaîne : en SQL, « ~* » et « || » ont la même
-- priorité, et « col ~* 'a' || 'b' » se lirait « (col ~* 'a') || 'b' ».
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_check CHECK (
  char_length(endpoint) <= 2048
  AND endpoint ~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/'
);

COMMENT ON CONSTRAINT push_subscriptions_endpoint_check ON push_subscriptions IS
  'Audit A-18 : l''adresse doit appartenir à un service de push de navigateur, sinon l''Edge Function pourrait écrire vers n''importe quel hôte.';
