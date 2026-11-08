import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  getPushDeviceState,
  sendTestNotification,
  urlBase64ToUint8Array,
} from './push';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';

const invoke = vi.fn();
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: { ...fakeSupabase, functions: { invoke: (...args: unknown[]) => invoke(...args) } } };
});

/** Navigateur simulé avec service worker et Push API */
function mockPushBrowser({ subscribed = false, permission = 'default' as NotificationPermission } = {}) {
  const subscription = {
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'BPclePublique', auth: 'secret' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscribed ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  };
  const notification = Object.assign(function Notification() {}, {
    permission,
    requestPermission: vi.fn().mockResolvedValue('granted'),
  });
  vi.stubGlobal('Notification', notification);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ pushManager }) },
  });
  return { pushManager, subscription, notification };
}

beforeEach(() => {
  supabaseMock.reset();
  invoke.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error nettoyage du faux service worker
  delete navigator.serviceWorker;
});

describe('push', () => {
  it('convertit la clé publique VAPID (base64url) en octets', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
  });

  it('signale un navigateur sans notifications push', async () => {
    await expect(getPushDeviceState()).resolves.toBe('unsupported');
  });

  it("indique si cet appareil reçoit les rappels", async () => {
    mockPushBrowser({ subscribed: false });
    await expect(getPushDeviceState()).resolves.toBe('disabled');
    mockPushBrowser({ subscribed: true });
    await expect(getPushDeviceState()).resolves.toBe('enabled');
    mockPushBrowser({ permission: 'denied' });
    await expect(getPushDeviceState()).resolves.toBe('denied');
  });

  it("abonne l'appareil avec la clé publique du service et l'enregistre", async () => {
    const { pushManager, notification } = mockPushBrowser();
    invoke.mockResolvedValue({ data: { publicKey: 'AQID' }, error: null });

    await enablePushOnThisDevice();

    expect(notification.requestPermission).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('send-reminders', { body: { action: 'public-key' } });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    const [call] = supabaseMock.callsFor('rpc:save_push_subscription');
    expect(getOperationArgs(call, 'rpc')?.[0]).toMatchObject({
      p_endpoint: 'https://push.example/abc',
      p_p256dh: 'BPclePublique',
      p_auth: 'secret',
    });
  });

  it("explique un refus d'autorisation", async () => {
    const { notification } = mockPushBrowser();
    notification.requestPermission.mockResolvedValue('denied');
    await expect(enablePushOnThisDevice()).rejects.toThrow('Notifications refusées');
  });

  it("désabonne l'appareil et le retire du compte", async () => {
    const { subscription } = mockPushBrowser({ subscribed: true });
    await disablePushOnThisDevice();

    expect(subscription.unsubscribe).toHaveBeenCalled();
    const [call] = supabaseMock.callsFor('push_subscriptions', 'delete');
    expect(getOperationArgs(call, 'eq')).toEqual(['endpoint', 'https://push.example/abc']);
  });

  it('demande une notification de test au service', async () => {
    invoke.mockResolvedValue({ data: { sent: 2, removed: 0, failed: 0 }, error: null });
    await expect(sendTestNotification()).resolves.toMatchObject({ sent: 2 });
    expect(invoke).toHaveBeenCalledWith('send-reminders', { body: { action: 'test' } });
  });
});
