import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeightQuickLog } from './WeightQuickLog';
import { supabaseMock } from '../../test/supabaseMock';
import { addDaysToDateString } from '../../shared/date';

vi.mock('../../shared/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

// Horloge figée (seul Date est simulé) : le moment proposé dépend de l'heure
const today = '2026-11-28';
const atHour = (hour: number) => vi.setSystemTime(new Date(2026, 10, 28, hour, 0, 0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  atHour(8);
  supabaseMock.reset();
  supabaseMock.setHandler(() => ({
    data: [
      { id: 'a', date: addDaysToDateString(today, -6), weight_kg: 81 },
      { id: 'b', date: today, weight_kg: 79.8 },
    ],
    error: null,
  }));
});

afterEach(() => {
  vi.useRealTimers();
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

    expect(onSave).toHaveBeenCalledWith(80.4, yesterday, 'morning');
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

    expect(onSave).toHaveBeenCalledWith(79.6, today, 'morning', { body_fat_pct: 18.5, muscle_mass_kg: 60.1, visceral_fat_rating: 7 });
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

  describe('moment de la pesée', () => {
    const logsReturned = (logs: object[]) => supabaseMock.setHandler(() => ({ data: logs, error: null }));
    const yesterday = addDaysToDateString(today, -1);
    const morningToday = { id: 'm', date: today, weight_kg: 66.1, moment: 'morning' };

    it('propose « Le matin, à jeun » avant midi, avec le conseil', async () => {
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={vi.fn()} />);

      const group = screen.getByRole('group', { name: 'Moment de la pesée' });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Le matin, à jeun' })).toBeChecked();
      expect(
        screen.getByText("Le matin, à jeun, après être passé aux toilettes : c'est la pesée la plus fiable.")
      ).toBeInTheDocument();
    });

    it('propose « Plus tard dans la journée » après midi', async () => {
      atHour(19);
      logsReturned([]);
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={79.8} onSave={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Plus tard dans la journée' })).toBeChecked();
    });

    it("reprend le moment de la pesée d'un jour passé et la rappelle", async () => {
      logsReturned([{ id: 'l', date: yesterday, weight_kg: 68.1, moment: 'later' }]);
      render(<WeightQuickLog userId="user-1" date={yesterday} currentWeight={79.8} onSave={vi.fn()} />);

      expect(await screen.findByText('Pesée de ce jour : 68,1 kg, plus tard dans la journée')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Plus tard dans la journée' })).toBeChecked();
    });

    it('rappelle une pesée du matin (ancienne pesée sans moment comprise)', async () => {
      logsReturned([{ id: 'o', date: yesterday, weight_kg: 68.1 }]);
      render(<WeightQuickLog userId="user-1" date={yesterday} currentWeight={79.8} onSave={vi.fn()} />);

      expect(await screen.findByText('Pesée de ce jour : 68,1 kg, le matin à jeun')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Le matin, à jeun' })).toBeChecked();
    });

    it('refuse qu’une pesée plus tard, avec un autre poids, remplace celle du matin', async () => {
      atHour(20);
      logsReturned([morningToday]);
      const onSave = vi.fn();
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={66.1} onSave={onSave} />);
      const user = userEvent.setup();
      await screen.findByText('Pesée de ce jour : 66,1 kg, le matin à jeun');

      await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '68');
      await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Votre pesée du matin (66,1 kg) reste celle de ce jour. Pour la corriger, choisissez « Le matin, à jeun ».'
      );
    });

    it('corrige seulement le moment, sans poids saisi', async () => {
      atHour(20);
      logsReturned([morningToday]);
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={66.1} onSave={onSave} />);
      const user = userEvent.setup();
      await screen.findByText('Pesée de ce jour : 66,1 kg, le matin à jeun');

      // « Plus tard » est proposé à 20 h : le bouton est actif sans poids saisi
      await user.click(screen.getByRole('button', { name: 'Mettre à jour' }));

      expect(onSave).toHaveBeenCalledWith(66.1, today, 'later');
    });

    it('le bouton reste inactif sans poids quand le moment ne change pas', async () => {
      logsReturned([morningToday]);
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={66.1} onSave={vi.fn()} />);
      await screen.findByText('Pesée de ce jour : 66,1 kg, le matin à jeun');

      expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeDisabled();
    });

    it('« Dernière » et « sur 7 jours » ignorent une pesée plus tard hors suivi', async () => {
      logsReturned([
        { id: 'a', date: addDaysToDateString(today, -6), weight_kg: 67, moment: 'morning' },
        { id: 'b', date: yesterday, weight_kg: 66.1, moment: 'morning' },
        { id: 'c', date: today, weight_kg: 68.1, moment: 'later' },
      ]);
      render(<WeightQuickLog userId="user-1" date={yesterday} currentWeight={66.1} onSave={vi.fn()} />);

      expect(await screen.findByText('66,1 kg', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText(/-0,9 kg sur 7 jours/)).toBeInTheDocument();
    });

    it('signale une pesée plus tard enregistrée hors suivi', async () => {
      atHour(20);
      let saved = false;
      const yesterdayMorning = { id: 'b', date: yesterday, weight_kg: 66.1, moment: 'morning' };
      supabaseMock.setHandler(() => ({
        data: saved ? [yesterdayMorning, { id: 'c', date: today, weight_kg: 68.1, moment: 'later' }] : [yesterdayMorning],
        error: null,
      }));
      const onSave = vi.fn().mockImplementation(async () => {
        saved = true;
      });
      render(<WeightQuickLog userId="user-1" date={today} currentWeight={66.1} onSave={onSave} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '68,1');
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(onSave).toHaveBeenCalledWith(68.1, today, 'later');
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Pesée enregistrée. Elle reste hors suivi : la pesée du matin sert de référence.'
      );
    });
  });
});
