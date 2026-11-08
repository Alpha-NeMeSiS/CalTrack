import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyCompositionChart } from './BodyCompositionChart';
import type { WeightLog } from '../../lib/supabase';

const log = (date: string, weight: number, extra: Partial<WeightLog> = {}): WeightLog => ({
  id: date,
  user_id: 'u',
  date,
  weight_kg: weight,
  created_at: `${date}T07:00:00Z`,
  ...extra,
});

const text = (element: HTMLElement) => (element.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

describe('BodyCompositionChart', () => {
  it('affiche masse grasse et masse maigre avec leur évolution', () => {
    render(
      <BodyCompositionChart
        logs={[
          log('2026-10-04', 82, { body_fat_pct: 25 }),
          log('2026-10-20', 81, { visceral_fat_rating: 9 }),
          log('2026-11-08', 79.6, { body_fat_pct: 22.5 }),
        ]}
      />
    );

    const fat = screen.getByRole('group', { name: 'Masse grasse' });
    // 79,6 × 22,5 % ≈ 17,9 kg ; 82 × 25 % = 20,5 kg
    expect(text(fat)).toContain('17,9 kg');
    expect(text(fat)).toContain('−2,6 kg');
    const lean = screen.getByRole('group', { name: 'Masse maigre' });
    expect(text(lean)).toContain('61,7 kg');
    expect(text(lean)).toContain('+0,2 kg');
    expect(screen.getByText(/depuis le 4 oct\./)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('une seule mesure : valeurs sans courbe', () => {
    render(<BodyCompositionChart logs={[log('2026-11-08', 79.6, { muscle_mass_kg: 58.6, bone_mass_kg: 3.1 })]} />);

    expect(text(screen.getByRole('group', { name: 'Masse maigre' }))).toContain('61,7 kg');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/Ajoutez une deuxième mesure/)).toBeInTheDocument();
  });

  it('explique comment commencer sans mesure de composition', () => {
    render(<BodyCompositionChart logs={[log('2026-11-08', 79.6)]} />);
    expect(screen.getByText(/carte « Ma pesée »/)).toBeInTheDocument();
  });
});
