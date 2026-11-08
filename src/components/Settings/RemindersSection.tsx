// Paramètres → Rappels : notifications sur cet appareil (action immédiate) et
// heures des rappels (enregistrées avec les autres paramètres).
import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  getPushDeviceState,
  PushDeviceState,
  sendTestNotification,
} from '../../lib/push';
import { DEFAULT_REMINDER_TIMES } from '../../utils/preferences';

interface RemindersSectionProps {
  weighInTime: string | null;
  logTime: string | null;
  onChange: (times: { weighInTime: string | null; logTime: string | null }) => void;
}

const DEVICE_MESSAGES: Record<Exclude<PushDeviceState, 'enabled' | 'disabled'>, string> = {
  unsupported:
    "Ce navigateur ne permet pas de recevoir les rappels. Ouvrez CalTrack dans Chrome, Edge ou Firefox, ou installez l'application.",
  'ios-install-required':
    "Sur iPhone et iPad, installez d'abord CalTrack sur l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-le depuis son icône.",
  denied:
    'Les notifications sont bloquées pour CalTrack. Autorisez-les dans les réglages du navigateur, puis revenez ici.',
};

export function RemindersSection({ weighInTime, logTime, onChange }: RemindersSectionProps) {
  const [deviceState, setDeviceState] = useState<PushDeviceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDeviceState(await getPushDeviceState());
    } catch {
      setDeviceState('unsupported');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ type: 'success', text: await action() });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Une erreur est survenue.' });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const enable = () =>
    run(async () => {
      await enablePushOnThisDevice();
      return 'Notifications activées sur cet appareil.';
    });
  const disable = () =>
    run(async () => {
      await disablePushOnThisDevice();
      return 'Cet appareil ne recevra plus les rappels.';
    });
  const test = () =>
    run(async () => {
      const result = await sendTestNotification();
      if (result.sent === 0) throw new Error("Aucun appareil n'a reçu la notification. Réactivez les notifications ici.");
      return `Notification envoyée (${result.sent} appareil${result.sent > 1 ? 's' : ''}).`;
    });

  const reminderRow = (
    id: string,
    label: string,
    hint: string,
    value: string | null,
    fallback: string,
    update: (time: string | null) => void
  ) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-1"
          checked={value !== null}
          onChange={(e) => update(e.target.checked ? fallback : null)}
        />
        <span>
          <span className="block font-medium text-gray-900">{label}</span>
          <span className="block text-xs text-gray-500">{hint}</span>
        </span>
      </label>
      <div>
        <label htmlFor={id} className="sr-only">
          Heure — {label}
        </label>
        <input
          id={id}
          type="time"
          value={value ?? fallback}
          disabled={value === null}
          onChange={(e) => update(e.target.value || fallback)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:text-gray-400"
        />
      </div>
    </div>
  );

  return (
    <section aria-labelledby="reminders-title" className="space-y-4 rounded-lg bg-white p-4 shadow-md sm:p-6">
      <div>
        <h2 id="reminders-title" className="flex items-center gap-2 text-lg text-gray-900">
          <BellRing className="h-5 w-5 text-gray-500" aria-hidden="true" />
          Rappels
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Une notification à l’heure choisie, seulement si ce n’est pas déjà fait ce jour-là.
        </p>
      </div>

      <div className="space-y-3">
        {reminderRow(
          'reminder-weigh-in',
          'Rappel de pesée',
          'Si aucune pesée n’est enregistrée ce jour-là',
          weighInTime,
          DEFAULT_REMINDER_TIMES.weighIn,
          (time) => onChange({ weighInTime: time, logTime })
        )}
        {reminderRow(
          'reminder-log',
          'Rappel du journal',
          'Si le dîner n’est pas encore noté',
          logTime,
          DEFAULT_REMINDER_TIMES.log,
          (time) => onChange({ weighInTime, logTime: time })
        )}
      </div>

      <div className="rounded-md border border-gray-200 p-3" data-testid="push-device">
        <p className="text-sm font-medium text-gray-900">Notifications sur cet appareil</p>
        {deviceState === null ? (
          <p className="mt-1 text-sm text-gray-500">Vérification…</p>
        ) : deviceState === 'enabled' || deviceState === 'disabled' ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {deviceState === 'enabled'
                ? 'Activées : cet appareil reçoit vos rappels.'
                : 'Désactivées : activez-les pour recevoir vos rappels ici.'}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {deviceState === 'enabled' ? (
                <>
                  <button
                    type="button"
                    onClick={test}
                    disabled={busy}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Envoyer une notification de test
                  </button>
                  <button
                    type="button"
                    onClick={disable}
                    disabled={busy}
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Désactiver sur cet appareil
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy}
                  className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {busy ? 'Activation…' : 'Activer les notifications sur cet appareil'}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-600">{DEVICE_MESSAGES[deviceState]}</p>
        )}
        {message && (
          <p
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`mt-2 text-sm ${message.type === 'error' ? 'text-red-700' : 'text-green-700'}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
