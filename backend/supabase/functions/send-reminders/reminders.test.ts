import { describe, expect, it } from 'vitest';
import { buildReminderMessage, buildTestMessage, isSubscriptionGone } from './reminders';

describe('messages des rappels', () => {
  it('rappelle la pesée', () => {
    expect(buildReminderMessage({ user_id: 'u', kind: 'weigh_in', local_date: '2026-11-09', entry_count: 0 })).toMatchObject({
      title: 'Pesée du jour',
      tag: 'caltrack-weigh-in',
      url: '/',
    });
  });

  it('adapte le rappel du journal à ce qui est déjà saisi', () => {
    expect(buildReminderMessage({ user_id: 'u', kind: 'log', local_date: '2026-11-09', entry_count: 0 }).body).toContain(
      'journal est vide'
    );
    expect(buildReminderMessage({ user_id: 'u', kind: 'log', local_date: '2026-11-09', entry_count: 1 }).body).toBe(
      "Pensez à ajouter votre dîner (1 aliment noté aujourd'hui)."
    );
    expect(buildReminderMessage({ user_id: 'u', kind: 'log', local_date: '2026-11-09', entry_count: 4 }).body).toContain(
      '4 aliments notés'
    );
  });

  it('fournit un message de test et reconnaît les abonnements expirés', () => {
    expect(buildTestMessage().tag).toBe('caltrack-test');
    expect(isSubscriptionGone(410)).toBe(true);
    expect(isSubscriptionGone(404)).toBe(true);
    expect(isSubscriptionGone(201)).toBe(false);
    expect(isSubscriptionGone(429)).toBe(false);
  });
});
