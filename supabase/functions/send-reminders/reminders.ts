// Messages des rappels (fonctions pures, sans dépendance : testées avec Vitest).

export type ReminderKind = 'weigh_in' | 'log';

/** Ligne renvoyée par la fonction SQL claim_due_reminders */
export interface DueReminder {
  user_id: string;
  kind: ReminderKind;
  local_date: string;
  /** Nombre d'aliments déjà saisis ce jour-là */
  entry_count: number;
}

/** Contenu de la notification, lu par le service worker (public/sw.js) */
export interface PushMessage {
  title: string;
  body: string;
  /** Page ouverte au clic */
  url: string;
  /** Une nouvelle notification du même type remplace la précédente */
  tag: string;
}

export function buildReminderMessage(reminder: DueReminder): PushMessage {
  if (reminder.kind === 'weigh_in') {
    return {
      title: 'Pesée du jour',
      body: 'Pesez-vous avant le petit-déjeuner pour suivre votre évolution.',
      url: '/',
      tag: 'caltrack-weigh-in',
    };
  }
  const count = Number(reminder.entry_count) || 0;
  return {
    title: 'Journal du jour',
    body:
      count === 0
        ? "Votre journal est vide aujourd'hui : notez vos repas en une minute."
        : `Pensez à ajouter votre dîner (${count} aliment${count > 1 ? 's' : ''} noté${count > 1 ? 's' : ''} aujourd'hui).`,
    url: '/',
    tag: 'caltrack-log',
  };
}

export function buildTestMessage(): PushMessage {
  return {
    title: 'CalTrack',
    body: 'Les rappels fonctionnent sur cet appareil.',
    url: '/',
    tag: 'caltrack-test',
  };
}

/** Abonnement expiré ou révoqué par le navigateur : à supprimer */
export function isSubscriptionGone(status: number): boolean {
  return status === 404 || status === 410;
}
