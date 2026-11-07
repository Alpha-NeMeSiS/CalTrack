import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroCard } from './MacroCard';

function getBar(container: HTMLElement) {
  return container.querySelector<HTMLDivElement>('[style]');
}

describe('MacroCard', () => {
  it('affiche la consommation, la cible et le restant arrondis', () => {
    const { container } = render(
      <MacroCard label="Protéines" consumed={70.4} target={140} unit="g" color="bg-kaizen-500" />
    );

    expect(screen.getByText('Protéines')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('/ 140')).toBeInTheDocument();
    expect(screen.getByText('Restant : 70 g')).toBeInTheDocument();
    expect(getBar(container)).toHaveStyle({ width: '50.28571428571429%' });
  });

  it('plafonne la barre à 100 % et le restant à 0', () => {
    const { container } = render(
      <MacroCard label="Lipides" consumed={90} target={60} unit="g" color="bg-red-500" />
    );
    expect(screen.getByText('Restant : 0 g')).toBeInTheDocument();
    expect(getBar(container)).toHaveStyle({ width: '100%' });
  });

  it('gère une cible à 0', () => {
    const { container } = render(<MacroCard label="Fibres" consumed={10} target={0} unit="g" color="bg-x" />);
    expect(getBar(container)).toHaveStyle({ width: '0%' });
  });
});
