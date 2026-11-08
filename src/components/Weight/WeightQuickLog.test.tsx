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

  it('enregistre la composition facultative avec la pesée', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={onSave} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '79,6');
    await user.click(screen.getByText('Composition (facultatif)'));
    await user.type(screen.getByLabelText('Masse grasse (%)'), '18,5');
    await user.type(screen.getByLabelText('Muscles (kg)'), '60.1');
    await user.type(screen.getByLabelText('Graisse viscérale'), '7');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(onSave).toHaveBeenCalledWith(79.6, today, { body_fat_pct: 18.5, muscle_mass_kg: 60.1, visceral_fat_rating: 7 });
    // Champs vidés après l'enregistrement
    expect(screen.getByLabelText('Masse grasse (%)')).toHaveValue('');
  });

  it('refuse une composition incohérente sans appeler onSave', async () => {
    const onSave = vi.fn();
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={onSave} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '79');
    await user.click(screen.getByText('Composition (facultatif)'));
    await user.type(screen.getByLabelText('Masse grasse (%)'), '75');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Le taux de masse grasse doit être compris entre 3 et 60 %.');
  });

  it('affiche la composition de la dernière pesée', async () => {
    supabaseMock.setHandler(() => ({
      data: [{ id: 'b', date: today, weight_kg: 79.8, body_fat_pct: 18.5, muscle_mass_kg: 60.1 }],
      error: null,
    }));
    render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={vi.fn()} />);

    expect(await screen.findByText('Masse grasse 18,5 % · muscles 60,1 kg')).toBeInTheDocument();
  });
});
