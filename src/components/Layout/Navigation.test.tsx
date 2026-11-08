import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Navigation } from './Navigation';

// jsdom n'applique pas le CSS : les deux barres (haut et bas) sont présentes
function getBars() {
  const [desktop, mobile] = screen.getAllByRole('navigation', { name: 'Navigation principale' });
  return { desktop, mobile };
}

describe('Navigation', () => {
  it('donne un libellé visible à chaque onglet mobile (régression : icônes seules)', () => {
    render(<Navigation currentView="dashboard" onViewChange={vi.fn()} />);
    const { mobile } = getBars();

    for (const name of ['Journal', 'Tendances', 'Objectif']) {
      expect(within(mobile).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it("indique l'onglet actif avec aria-current", () => {
    render(<Navigation currentView="trends" onViewChange={vi.fn()} />);
    const { desktop, mobile } = getBars();

    expect(within(desktop).getByRole('button', { name: 'Tendances' })).toHaveAttribute('aria-current', 'page');
    expect(within(mobile).getByRole('button', { name: 'Tendances' })).toHaveAttribute('aria-current', 'page');
    expect(within(mobile).getByRole('button', { name: 'Journal' })).not.toHaveAttribute('aria-current');
  });

  it('change de vue depuis la barre mobile comme depuis la barre du haut', async () => {
    const onViewChange = vi.fn();
    render(<Navigation currentView="dashboard" onViewChange={onViewChange} />);
    const { desktop, mobile } = getBars();
    const user = userEvent.setup();

    await user.click(within(mobile).getByRole('button', { name: 'Objectif' }));
    await user.click(within(desktop).getByRole('button', { name: 'Tendances' }));

    expect(onViewChange).toHaveBeenNthCalledWith(1, 'goal');
    expect(onViewChange).toHaveBeenNthCalledWith(2, 'trends');
  });
});
