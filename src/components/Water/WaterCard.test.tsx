import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaterLog } from '../../lib/supabase';
import { WaterCard } from './WaterCard';
import { addWaterLog, deleteWaterLog, fetchWaterLogs } from '../../services/water';

vi.mock('../../services/water', () => ({
  fetchWaterLogs: vi.fn(),
  addWaterLog: vi.fn(),
  deleteWaterLog: vi.fn(),
}));

const log = (id: string, amount_ml: number, created_at: string, date = '2026-11-08'): WaterLog => ({
  id,
  user_id: 'user-1',
  date,
  amount_ml,
  created_at,
});

const morning = [log('w1', 250, '2026-11-08T08:00:00Z'), log('w2', 500, '2026-11-08T10:00:00Z'), log('w3', 500, '2026-11-08T12:00:00Z')];

beforeEach(() => {
  vi.mocked(fetchWaterLogs).mockResolvedValue(morning);
  vi.mocked(addWaterLog).mockImplementation(async (_user, date, amount) => log(`new-${amount}`, amount, '2026-11-08T15:00:00Z', date));
  vi.mocked(deleteWaterLog).mockResolvedValue(undefined);
});

describe('WaterCard', () => {
  it('affiche le total, l’objectif et ce qu’il reste à boire', async () => {
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    expect(await screen.findByText('1,25 L')).toBeInTheDocument();
    expect(screen.getByText(/\/ 2,4 L/)).toBeInTheDocument();
    expect(screen.getByText('52 %')).toBeInTheDocument();
    expect(screen.getByText('Encore 1,15 L')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Eau bue par rapport à l’objectif' })).toHaveAttribute('aria-valuenow', '52');
    expect(fetchWaterLogs).toHaveBeenCalledWith('user-1', '2026-11-08', '2026-11-08');
  });

  it('ajoute 250 ml en un geste', async () => {
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');
    await userEvent.setup().click(screen.getByRole('button', { name: '+ 250 ml' }));

    expect(addWaterLog).toHaveBeenCalledWith('user-1', '2026-11-08', 250);
    expect(await screen.findByText('1,5 L')).toBeInTheDocument();
  });

  it('ignore un second tap pendant l’envoi', async () => {
    let resolve: (value: WaterLog) => void = () => {};
    vi.mocked(addWaterLog).mockImplementation(() => new Promise((r) => (resolve = r)));
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');

    const button = screen.getByRole('button', { name: '+ 500 ml' });
    const user = userEvent.setup();
    await user.click(button);
    await user.click(button);
    expect(addWaterLog).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => resolve(log('w4', 500, '2026-11-08T16:00:00Z')));
    expect(await screen.findByText('1,75 L')).toBeInTheDocument();
  });

  it('ajoute une quantité libre et refuse une quantité invalide', async () => {
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Autre…' }));
    await user.type(screen.getByLabelText('Quantité (ml)'), '0');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByText('Indiquez une quantité entre 1 et 3 000 ml.')).toBeInTheDocument();
    expect(addWaterLog).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Quantité (ml)'));
    await user.type(screen.getByLabelText('Quantité (ml)'), '330');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(addWaterLog).toHaveBeenCalledWith('user-1', '2026-11-08', 330);
    expect(await screen.findByText('1,58 L')).toBeInTheDocument();
    expect(screen.queryByLabelText('Quantité (ml)')).not.toBeInTheDocument();
  });

  it('annule la dernière prise', async () => {
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Annuler le dernier (+ 500 ml)' }));

    expect(deleteWaterLog).toHaveBeenCalledWith('w3');
    expect(await screen.findByText('0,75 L')).toBeInTheDocument();
  });

  it('signale l’objectif atteint', async () => {
    vi.mocked(fetchWaterLogs).mockResolvedValue([...morning, log('w4', 1350, '2026-11-08T18:00:00Z')]);
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    expect(await screen.findByText('Objectif atteint · 108 %')).toBeInTheDocument();
    expect(screen.queryByText(/Encore/)).not.toBeInTheDocument();
  });

  it('garde le total si l’ajout échoue', async () => {
    vi.mocked(addWaterLog).mockRejectedValue(new Error('réseau'));
    render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');
    await userEvent.setup().click(screen.getByRole('button', { name: '+ 250 ml' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('L’eau n’a pas pu être enregistrée. Réessayez.');
    expect(screen.getByText('1,25 L')).toBeInTheDocument();
  });

  it('suit la date choisie dans le journal', async () => {
    vi.mocked(fetchWaterLogs).mockImplementation(async (_user, from) =>
      from === '2026-11-07' ? [log('y1', 2000, '2026-11-07T09:00:00Z', '2026-11-07')] : morning
    );
    const { rerender } = render(<WaterCard userId="user-1" date="2026-11-08" goalMl={2400} />);
    await screen.findByText('1,25 L');

    rerender(<WaterCard userId="user-1" date="2026-11-07" goalMl={2400} />);
    await waitFor(() => expect(screen.getByText('2 L')).toBeInTheDocument());
    expect(screen.queryByText('1,25 L')).not.toBeInTheDocument();
  });
});
