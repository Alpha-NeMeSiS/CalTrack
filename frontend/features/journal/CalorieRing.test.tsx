import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalorieRing } from './CalorieRing';

describe('CalorieRing', () => {
  it('affiche les kcal restantes sous l’objectif', () => {
    render(<CalorieRing consumed={1500} target={2000} status="under" />);
    expect(screen.getByText("Sous l'objectif")).toBeInTheDocument();
    expect(screen.getByText('Encore 500 kcal')).toBeInTheDocument();
  });

  it('affiche le dépassement', () => {
    render(<CalorieRing consumed={2300} target={2000} status="over" />);
    expect(screen.getByText('Au-dessus')).toBeInTheDocument();
    expect(screen.getByText('+300 kcal')).toBeInTheDocument();
  });

  it('félicite quand l’objectif est atteint', () => {
    render(<CalorieRing consumed={2000} target={2000} status="ok" />);
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument();
    expect(screen.getByText('Parfait !')).toBeInTheDocument();
  });

  it("affiche « En cours » au lieu de « Sous l'objectif » pour la journée en cours (régression)", () => {
    render(<CalorieRing consumed={978} target={2150} status="under" inProgress />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.queryByText("Sous l'objectif")).not.toBeInTheDocument();
    expect(screen.getByText('Encore 1172 kcal')).toBeInTheDocument();
  });

  it('affiche la journée en cours en vert de la marque', () => {
    const { container } = render(<CalorieRing consumed={978} target={2150} status="under" inProgress />);
    expect(screen.getByText('En cours')).toHaveClass('bg-brand-50', 'text-brand-700');
    expect(container.querySelectorAll('circle')[1]).toHaveClass('stroke-brand-600');
  });

  it('signale un dépassement même pendant la journée en cours', () => {
    render(<CalorieRing consumed={2400} target={2150} status="over" inProgress />);
    expect(screen.getByText('Au-dessus')).toBeInTheDocument();
  });

  it('ne produit pas de NaN avec une cible à 0', () => {
    const { container } = render(<CalorieRing consumed={0} target={0} status="ok" />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.getAttribute('stroke-dashoffset')).not.toBe('NaN');
  });

  it('met les calories restantes en avant si demandé', () => {
    render(<CalorieRing consumed={1450} target={2150} status="under" display="remaining" />);
    expect(screen.getByText('700')).toBeInTheDocument();
    expect(screen.getByText('kcal restantes')).toBeInTheDocument();
    expect(screen.getByText('1450 / 2150 kcal consommées')).toBeInTheDocument();
  });

  it('affiche le dépassement en mode « restantes »', () => {
    render(<CalorieRing consumed={2400} target={2150} status="over" display="remaining" />);
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('kcal en trop')).toBeInTheDocument();
  });
});

