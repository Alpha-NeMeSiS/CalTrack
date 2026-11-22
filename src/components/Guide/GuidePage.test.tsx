import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuidePage } from './GuidePage';

const TITLES = [
  'Premiers pas',
  'Noter un repas',
  'Eau',
  'Pesée et composition',
  'Objectif et calories',
  'Tendances',
  'Réglages et compte',
  'Installer l’app sur le téléphone',
];

describe('GuidePage', () => {
  it('présente les 8 sections du guide', () => {
    render(<GuidePage signedIn={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument();
    expect(screen.getByText('Les bases de CalTrack en quelques minutes.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(TITLES);
    expect(screen.getByText(/Sur iPhone, les rappels ne fonctionnent qu’une fois l’app installée\./)).toBeInTheDocument();
    expect(screen.getByText(/Copier les repas de la veille/)).toBeInTheDocument();
  });

  it('numérote les étapes de « Premiers pas » et « Noter un repas »', () => {
    render(<GuidePage signedIn={false} />);
    for (const id of ['guide-start', 'guide-meals']) {
      expect(document.getElementById(id)?.querySelector('ol')).not.toBeNull();
    }
  });

  it('propose « Revoir la visite » seulement une fois connecté', async () => {
    const { rerender } = render(<GuidePage signedIn={false} />);
    expect(screen.queryByRole('button', { name: 'Revoir la visite' })).not.toBeInTheDocument();

    const onReplayTour = vi.fn();
    rerender(<GuidePage signedIn onReplayTour={onReplayTour} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoir la visite' }));
    expect(onReplayTour).toHaveBeenCalledTimes(1);
  });
});
