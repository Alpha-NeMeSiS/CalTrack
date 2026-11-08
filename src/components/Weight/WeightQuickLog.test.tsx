import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeightQuickLog } from './WeightQuickLog';
import { supabaseMock } from '../../test/supabaseMock';
import { addDaysToDateString, getTodayDate } from '../../utils/date';

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const today = getTodayDate();

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setHandler(() => ({
    data: [
      { id: 'a', date: addDaysToDateString(today, -6), weight_kg: 81 },
      { id: 'b', date: today, weight_kg: 79.8 },
    ],
    error: null,
  }));
});

describe('WeightQuickLog', () => {
  it("affiche la dernière pesée et l'évolution sur 7 jours", async () => {
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={vi.fn()} />);

    expect(await screen.findByText('79,8 kg')).toBeInTheDocument();
    expect(screen.getByText(/-1,2 kg sur 7 jours/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeInTheDocument();
  });

  it('enregistre une pesée (virgule acceptée) pour la date affichée', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const yesterday = addDaysToDateString(today, -1);
    render(<WeightQuickLog userId="user-1" date={yesterday} currentWeight={79.8} onSave={onSave} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Poids ce jour-là (kg)'), '80,4');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith(80.4, yesterday);
    expect(await screen.findByRole('status')).toHaveTextContent('Pesée enregistrée.');
  });

  it('refuse un poids hors limites sans appeler onSave', async () => {
    const onSave = vi.fn();
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={onSave} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '12');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Le poids doit être compris entre 30 et 300 kg.');
  });

  it("affiche un message si l'enregistrement échoue", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('réseau'));
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={onSave} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '79');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("La pesée n'a pas pu être enregistrée.");
  });
});
