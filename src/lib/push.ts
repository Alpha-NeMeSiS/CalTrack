// Notifications push (rappels) sur cet appareil.
// - L'abonnement du navigateur est enregistré dans push_subscriptions
//   (fonction SQL save_push_subscription) ;
// - la clé publique VAPID et la notification de test passent par l'Edge
//   Function send-reminders ;
// - le service worker (public/sw.js) affiche les notifications reçues.
import { supabase } from './supabase';

export type PushDeviceState =
  /** Navigateur sans notifications push (ou application lancée sans service worker) */
  | 'unsupported'
  /** iPhone / iPad : il faut d'abord installer l'application sur l'écran d'accueil */
  | 'ios-install-required'
  /** Notifications bloquées dans les réglages du navigateur */
  | 'denied'
  | 'disabled'
  | 'enabled';

const REMINDERS_FUNCTION = 'send-reminders';

/** Clé VAPID base64url → octets (format attendu par pushManager.subscribe) */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isIosBrowserNotInstalled(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function hasPushApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasPushApi()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function getPushDeviceState(): Promise<PushDeviceState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIosBrowserNotInstalled() && !hasPushApi()) return 'ios-install-required';
  if (!hasPushApi()) return 'unsupported';
  // Le service worker n'est enregistré qu'en production (voir registerServiceWorker)
  if (!(await getRegistration())) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await getSubscription()) ? 'enabled' : 'disabled';
}

async function saveSubscription(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Abonnement du navigateur incomplet.');
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error("L'appareil n'a pas pu être enregistré.");
}

/** Demande l'autorisation, abonne le navigateur et l'enregistre pour le compte connecté */
export async function enablePushOnThisDevice(): Promise<void> {
  const registration = await getRegistration();
  if (!registration) throw new Error('Les notifications ne sont pas disponibles dans ce navigateur.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications refusées : autorisez-les pour CalTrack dans les réglages du navigateur.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { data, error } = await supabase.functions.invoke(REMINDERS_FUNCTION, { body: { action: 'public-key' } });
    const publicKey = (data as { publicKey?: string } | null)?.publicKey;
    if (error || !publicKey) throw new Error('Le service de rappels est indisponible. Réessayez plus tard.');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await saveSubscription(subscription);
}

/** Désabonne ce navigateur et le retire du compte */
export async function disablePushOnThisDevice(): Promise<void> {
  const subscription = await getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw new Error("L'appareil n'a pas pu être retiré du compte.");
}

/** Notification de test sur les appareils du compte */
export async function sendTestNotification(): Promise<{ sent: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke(REMINDERS_FUNCTION, { body: { action: 'test' } });
  if (error || !data) throw new Error("La notification de test n'a pas pu être envoyée.");
  return data as { sent: number; failed: number };
}

/**
 * À la déconnexion : ce navigateur ne reçoit plus les rappels du compte
 * (sans bloquer la déconnexion si le réseau est indisponible).
 */
export async function forgetThisDevice(timeoutMs = 2000): Promise<void> {
  if (!hasPushApi()) return;
  const forget = disablePushOnThisDevice().catch(() => undefined);
  await Promise.race([forget, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
