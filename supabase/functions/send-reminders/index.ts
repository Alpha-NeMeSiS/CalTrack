// Edge Function « send-reminders » : envoie les rappels push de CalTrack.
//
// Trois usages :
//   - tâche planifiée (pg_cron, toutes les 15 min), authentifiée par l'en-tête
//     x-cron-secret : envoie les rappels dus (fonction SQL claim_due_reminders) ;
//   - { action: 'public-key' } (utilisateur connecté) : clé publique VAPID
//     nécessaire au navigateur pour s'abonner ;
//   - { action: 'test' } (utilisateur connecté) : notification de test sur
//     tous ses appareils.
// Les clés VAPID sont générées au premier appel et conservées dans Supabase
// Vault (fonctions get/init_push_vapid_keys) : aucune clé dans le dépôt.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { buildReminderMessage, buildTestMessage, DueReminder, isSubscriptionGone, PushMessage } from './reminders.ts';

const VAPID_SUBJECT = 'https://caltrack-ap.netlify.app';
/** Durée de vie d'une notification non délivrée (appareil éteint) */
const TTL_SECONDS = 4 * 60 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type VapidKeys = { public_key: string; private_key: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Clés VAPID (créées au premier appel puis relues depuis Vault) */
async function getVapidKeys(): Promise<VapidKeys> {
  const { data, error } = await admin.rpc('get_push_vapid_keys');
  if (error) throw error;
  const existing = (data as VapidKeys[] | null)?.[0];
  if (existing?.public_key && existing?.private_key) return existing;

  const generated = webpush.generateVAPIDKeys();
  const { data: stored, error: initError } = await admin.rpc('init_push_vapid_keys', {
    p_public: generated.publicKey,
    p_private: generated.privateKey,
  });
  if (initError) throw initError;
  const keys = (stored as VapidKeys[] | null)?.[0];
  if (!keys) throw new Error('Clés VAPID introuvables');
  return keys;
}

/** Envoie un message à tous les appareils d'un utilisateur */
async function sendToUser(userId: string, message: PushMessage, keys: VapidKeys) {
  const result = { sent: 0, removed: 0, failed: 0 };
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) throw error;

  for (const subscription of subscriptions ?? []) {
    try {
      // Chiffrement par web-push, envoi avec fetch (natif dans Deno)
      const request = webpush.generateRequestDetails(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message),
        {
          TTL: TTL_SECONDS,
          urgency: 'normal',
          topic: message.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32),
          vapidDetails: { subject: VAPID_SUBJECT, publicKey: keys.public_key, privateKey: keys.private_key },
        }
      );
      const response = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      if (response.ok) {
        result.sent += 1;
        await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).eq('id', subscription.id);
      } else if (isSubscriptionGone(response.status)) {
        result.removed += 1;
        await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      } else {
        result.failed += 1;
        console.error('Push refusé', response.status, await response.text());
      }
    } catch (error) {
      result.failed += 1;
      console.error('Push en erreur', error);
    }
  }
  return result;
}

async function handleCron(secret: string) {
  const { data: allowed, error } = await admin.rpc('check_reminders_cron_secret', { p_secret: secret });
  if (error) throw error;
  if (allowed !== true) return json({ error: 'Accès refusé' }, 401);

  const { data: due, error: claimError } = await admin.rpc('claim_due_reminders');
  if (claimError) throw claimError;
  const reminders = (due as DueReminder[] | null) ?? [];
  const totals = { due: reminders.length, sent: 0, removed: 0, failed: 0 };
  if (reminders.length === 0) return json(totals);

  const keys = await getVapidKeys();
  for (const reminder of reminders) {
    const result = await sendToUser(reminder.user_id, buildReminderMessage(reminder), keys);
    totals.sent += result.sent;
    totals.removed += result.removed;
    totals.failed += result.failed;
  }
  return json(totals);
}

async function handleUserAction(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Authentification requise' }, 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Session invalide' }, 401);

  const body = await req.json().catch(() => ({}));
  const keys = await getVapidKeys();
  if (body?.action === 'public-key') return json({ publicKey: keys.public_key });
  if (body?.action === 'test') return json(await sendToUser(data.user.id, buildTestMessage(), keys));
  return json({ error: 'Action inconnue' }, 400);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  try {
    const cronSecret = req.headers.get('x-cron-secret');
    return cronSecret ? await handleCron(cronSecret) : await handleUserAction(req);
  } catch (error) {
    console.error('send-reminders', error);
    return json({ error: 'Erreur interne' }, 500);
  }
});
