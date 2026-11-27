import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useModalFocus } from './useModalFocus';

function Modal({ onClose, closeOnEscape }: { onClose: () => void; closeOnEscape?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useModalFocus(ref, onClose, { closeOnEscape });
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Fenêtre">
      <button type="button">Premier</button>
      <input aria-label="Champ" />
      <a href="#x">Lien</a>
      <button type="button">Dernier</button>
    </div>
  );
}

function Page({ open, closeOnEscape }: { open: boolean; closeOnEscape?: boolean }) {
  return (
    <>
      <button type="button">Ouvrir</button>
      {open && <Modal onClose={() => {}} closeOnEscape={closeOnEscape} />}
      <button type="button">Derrière</button>
    </>
  );
}

describe('useModalFocus', () => {
  it('Tab depuis le dernier élément revient au premier', async () => {
    render(<Page open />);
    screen.getByRole('button', { name: 'Dernier' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Premier' })).toHaveFocus();
  });

  it('Maj+Tab depuis le premier élément va au dernier', async () => {
    render(<Page open />);
    screen.getByRole('button', { name: 'Premier' }).focus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dernier' })).toHaveFocus();
  });

  it('inclut les champs et les liens, pas seulement les boutons', async () => {
    render(<Page open />);
    screen.getByRole('button', { name: 'Premier' }).focus();
    await userEvent.tab();
    expect(screen.getByLabelText('Champ')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Lien' })).toHaveFocus();
  });

  it('ne laisse jamais le focus atteindre la page derrière', async () => {
    render(<Page open />);
    const dialog = screen.getByRole('dialog');
    screen.getByRole('button', { name: 'Premier' }).focus();
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('Échap ferme la fenêtre', async () => {
    const onClose = vi.fn();
    function Only() {
      const ref = useRef<HTMLDivElement | null>(null);
      useModalFocus(ref, onClose);
      return <div ref={ref} role="dialog" aria-modal="true" aria-label="F" />;
    }
    render(<Only />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Échap sans effet quand closeOnEscape est false (enregistrement en cours)', async () => {
    const onClose = vi.fn();
    function Only() {
      const ref = useRef<HTMLDivElement | null>(null);
      useModalFocus(ref, onClose, { closeOnEscape: false });
      return <div ref={ref} role="dialog" aria-modal="true" aria-label="F" />;
    }
    render(<Only />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bloque le défilement de la page pendant l’ouverture, et le rétablit', () => {
    const { unmount } = render(<Page open />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('rend le focus au bouton qui a ouvert la fenêtre', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Ouvrant';
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<Modal onClose={() => {}} />);
    screen.getByRole('button', { name: 'Dernier' }).focus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
