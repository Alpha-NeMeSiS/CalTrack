import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedTour } from './GuidedTour';
import { TOUR_STEPS, TourTarget } from '../../utils/tour';

// Cibles simulées : jsdom ne calcule pas la mise en page, on fixe leurs rectangles
const targets: HTMLElement[] = [];
function addTarget(id: TourTarget, rect = { top: 200, left: 20, width: 300, height: 120 }) {
  const el = document.createElement('div');
  el.dataset.tour = id;
  let current = rect;
  el.getBoundingClientRect = () =>
    ({ ...current, x: current.left, y: current.top, right: current.left + current.width, bottom: current.top + current.height, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  targets.push(el);
  return { el, move: (next: typeof rect) => (current = next) };
}
const addAll = (except: TourTarget[] = []) =>
  (['calories', 'add', 'water', 'weight', 'nav'] as TourTarget[]).filter((id) => !except.includes(id)).forEach((id) => addTarget(id));

beforeEach(() => {
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy;
});
afterEach(() => {
  targets.splice(0).forEach((el) => el.remove());
});

describe('GuidedTour', () => {
  it('affiche l’étape 1 dans une fenêtre de dialogue, focus sur « Suivant »', async () => {
    addAll();
    render(<GuidedTour steps={TOUR_STEPS} onFinish={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Votre journée en un coup d’œil' });
    expect(dialog).toHaveTextContent('Étape 1 sur 5');
    expect(screen.queryByRole('button', { name: 'Précédent' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivant' })).toHaveFocus());
  });

  it('avance et recule entre les étapes', async () => {
    addAll();
    render(<GuidedTour steps={TOUR_STEPS} onFinish={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('dialog', { name: 'Noter ce que vous mangez' })).toHaveTextContent('Étape 2 sur 5');
    await user.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByRole('dialog', { name: 'Votre journée en un coup d’œil' })).toBeInTheDocument();
  });

  it('se termine par « Terminer » (done), ou par « Passer » et Échap (skipped)', async () => {
    addAll();
    const onFinish = vi.fn();
    const { unmount } = render(<GuidedTour steps={TOUR_STEPS} onFinish={onFinish} />);
    const user = userEvent.setup();
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('dialog', { name: 'Aller plus loin' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(onFinish).toHaveBeenLastCalledWith('done');
    unmount();

    const onSkip = vi.fn();
    const second = render(<GuidedTour steps={TOUR_STEPS} onFinish={onSkip} />);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(onSkip).toHaveBeenLastCalledWith('skipped');
    second.unmount();

    const onEscape = vi.fn();
    render(<GuidedTour steps={TOUR_STEPS} onFinish={onEscape} />);
    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenLastCalledWith('skipped');
  });

  it('saute une étape dont la cible est absente et ajuste le compteur', async () => {
    addAll(['weight']);
    render(<GuidedTour steps={TOUR_STEPS} onFinish={vi.fn()} />);
    const user = userEvent.setup();
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('dialog', { name: 'Aller plus loin' })).toHaveTextContent('Étape 4 sur 4');
  });

  it('se termine sans rien afficher quand aucune cible n’existe', () => {
    const onFinish = vi.fn();
    render(<GuidedTour steps={TOUR_STEPS} onFinish={onFinish} />);
    expect(onFinish).toHaveBeenCalledWith('skipped');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('garde le clavier dans la bulle', async () => {
    addAll();
    const outside = document.createElement('button');
    outside.textContent = 'Dehors';
    document.body.appendChild(outside);
    targets.push(outside);
    render(<GuidedTour steps={TOUR_STEPS} onFinish={vi.fn()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivant' })).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Passer' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Suivant' })).toHaveFocus();
  });

  it('montre l’élément visible quand la cible existe en double (Review Focus 2)', async () => {
    addTarget('calories', { top: 0, left: 0, width: 0, height: 0 });
    addTarget('calories', { top: 200, left: 40, width: 250, height: 150 });
    render(<GuidedTour steps={TOUR_STEPS.slice(0, 1)} onFinish={vi.fn()} />);
    const hole = screen.getByTestId('tour-hole');
    await waitFor(() => expect(hole.style.width).toBe(`${250 + 12}px`));
    expect(hole.style.top).toBe(`${200 - 6}px`);
  });

  it('replace la découpe quand l’écran change de taille (Review Focus 3)', async () => {
    const { move } = addTarget('calories', { top: 200, left: 40, width: 250, height: 150 });
    render(<GuidedTour steps={TOUR_STEPS.slice(0, 1)} onFinish={vi.fn()} />);
    const hole = screen.getByTestId('tour-hole');
    await waitFor(() => expect(hole.style.top).toBe(`${200 - 6}px`));
    move({ top: 300, left: 40, width: 250, height: 150 });
    window.dispatchEvent(new Event('resize'));
    await waitFor(() => expect(hole.style.top).toBe(`${300 - 6}px`));
  });
});
