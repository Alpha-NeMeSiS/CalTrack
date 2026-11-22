import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalTargetsPreview } from './GoalTargetsPreview';

const fortyYearsAgo = `${new Date().getFullYear() - 40}-01-01`;
const smallWoman = { sexe: 'F' as const, date_naissance: fortyYearsAgo, taille_cm: 155, poids_kg: 50 };
const man = { sexe: 'M' as const, date_naissance: fortyYearsAgo, taille_cm: 178, poids_kg: 80 };

describe('GoalTargetsPreview', () => {
  it("affiche les calories et macros de l'objectif avant validation", () => {
    render(<GoalTargetsPreview profile={man} goal={{ type: 'maintain', activity_level: 1.55, deficit_or_surplus_pct: 0 }} />);

    expect(screen.getByRole('region', { name: 'Aperçu de votre objectif quotidien' })).toBeInTheDocument();
    expect(screen.getByTestId('preview-calories').textContent).toMatch(/^\d{4} kcal$/);
    // 178 cm / 80 kg : IMC 25,2 → poids de référence 79,2 kg → 2 g/kg = 158 g
    expect(screen.getByText(/Protéines 158 g/)).toBeInTheDocument();
  });

  it('signale le plancher calorique appliqué', () => {
    render(
      <GoalTargetsPreview
        profile={smallWoman}
        goal={{ type: 'loss', activity_level: 1.2, deficit_or_surplus_pct: 30 }}
      />
    );

    expect(screen.getByTestId('preview-calories')).toHaveTextContent('1200 kcal');
    expect(screen.getByText(/Calories relevées à 1200 kcal/)).toBeInTheDocument();
  });

  it('propose une durée réaliste pour un rythme trop rapide', async () => {
    const onApplyDuration = vi.fn();
    render(
      <GoalTargetsPreview
        profile={man}
        goal={{ type: 'loss', activity_level: 1.55, deficit_or_surplus_pct: 20, target_weight_kg: 70, duration_weeks: 4 }}
        onApplyDuration={onApplyDuration}
      />
    );

    expect(screen.getByText(/Rythme trop rapide/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Utiliser 13 semaines' }));
    expect(onApplyDuration).toHaveBeenCalledWith(13);
  });

  it("ne s'affiche pas tant que le profil est incomplet", () => {
    const { container } = render(
      <GoalTargetsPreview
        profile={{ ...man, date_naissance: '' }}
        goal={{ type: 'maintain', activity_level: 1.55, deficit_or_surplus_pct: 0 }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
