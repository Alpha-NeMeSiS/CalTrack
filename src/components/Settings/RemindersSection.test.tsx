import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemindersSection } from './RemindersSection';
import type { PushDeviceState } from '../../lib/push';

const push = vi.hoisted(() => ({
  state: 'disabled' as PushDeviceState,
  enable: vi.fn(),
  disable: vi.fn(),
  test: vi.fn(),
}));

vi.mock('../../lib/push', () => ({
  getPushDeviceState: () => Promise.resolve(push.state),
  enablePushOnThisDevice: () => push.enable(),
  disablePushOnThisDevice: () => push.disable(),
  sendTestNotification: () => push.test(),
}));

beforeEach(() => {
  push.state = 'disabled';
  push.enable.mockReset().mockImplementation(async () => {
    push.state = 'enabled';
  });
  push.disable.mockReset().mockResolvedValue(undefined);
  push.test.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
});

describe('RemindersSection', () => {
  it('active et règle les heures des rappels', async () => {
    const onChange = vi.fn();
    render(<RemindersSection weighInTime={null} logTime="20:30" onChange={onChange} />);
    const user = userEvent.setup();

    expect(screen.getByLabelText('Heure — Rappel de pesée')).toBeDisabled();
    expect(screen.getByLabelText('Heure — Rappel du journal')).toHaveValue('20:30');

    await user.click(screen.getByRole('checkbox', { name: /Rappel de pesée/ }));
    expect(onChange).toHaveBeenLastCalledWith({ weighInTime: '08:00', logTime: '20:30' });

    await user.click(screen.getByRole('checkbox', { name: /Rappel du journal/ }));
    expect(onChange).toHaveBeenLastCalledWith({ weighInTime: null, logTime: null });
  });

  it('active les notifications sur cet appareil puis envoie un test', async () => {
    render(<RemindersSection weighInTime="08:00" logTime={null} onChange={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Activer les notifications sur cet appareil' }));
    expect(push.enable).toHaveBeenCalled();
    expect(await screen.findByText('Notifications activées sur cet appareil.')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Envoyer une notification de test' }));
    expect(await screen.findByText('Notification envoyée (1 appareil).')).toBeInTheDocument();
  });

  it("affiche l'erreur d'activation", async () => {
    push.enable.mockRejectedValue(new Error('Notifications refusées : autorisez-les.'));
    render(<RemindersSection weighInTime={null} logTime={null} onChange={vi.fn()} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Activer les notifications sur cet appareil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications refusées');
  });

  it("explique ce qu'il faut faire sur iPhone et quand les notifications sont bloquées", async () => {
    push.state = 'ios-install-required';
    const { unmount } = render(<RemindersSection weighInTime={null} logTime={null} onChange={vi.fn()} />);
    expect(await screen.findByText(/installez d'abord CalTrack sur l'écran d'accueil/)).toBeInTheDocument();
    unmount();

    push.state = 'denied';
    render(<RemindersSection weighInTime={null} logTime={null} onChange={vi.fn()} />);
    expect(await screen.findByText(/notifications sont bloquées/)).toBeInTheDocument();
  });
});
