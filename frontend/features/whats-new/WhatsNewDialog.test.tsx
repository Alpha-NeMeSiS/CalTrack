import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhatsNewDialog } from './WhatsNewDialog';
import type { ReleaseNote } from './releaseNotes';

const v210: ReleaseNote = { version: '2.1.0', date: '2026-12-03', items: ['Visite guidée', 'Nouvelle page Guide'] };
const v201: ReleaseNote = { version: '2.0.1', date: '2026-11-25', items: ['Correctif scanner'] };

describe('WhatsNewDialog', () => {
  it('présente une mise à jour avec sa version, sa date et ses points', async () => {
    render(<WhatsNewDialog releases={[v210]} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Quoi de neuf ?' });
    expect(dialog).toHaveTextContent('CalTrack a été mis à jour');
    expect(screen.getByText('Version 2.1.0 · 3 décembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Visite guidée')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'C’est noté' })).toHaveFocus());
  });

  it('regroupe plusieurs versions manquées, la plus récente en premier', () => {
    render(<WhatsNewDialog releases={[v210, v201]} onClose={vi.fn()} />);
    expect(screen.getByText('2 mises à jour depuis votre dernière visite')).toBeInTheDocument();
    const headings = screen.getAllByText(/^Version /).map((el) => el.textContent);
    expect(headings).toEqual(['Version 2.1.0 · 3 décembre 2026', 'Version 2.0.1 · 25 novembre 2026']);
  });

  it('accepte un sous-titre (historique depuis « À propos »)', () => {
    render(<WhatsNewDialog releases={[v210, v201]} onClose={vi.fn()} subtitle="Historique des mises à jour" />);
    expect(screen.getByText('Historique des mises à jour')).toBeInTheDocument();
  });

  it('se ferme avec « C’est noté », la croix ou Échap, mais pas d’un clic sur le fond', async () => {
    const onClose = vi.fn();
    render(<WhatsNewDialog releases={[v210]} onClose={onClose} />);
    const user = userEvent.setup();

    fireEvent.click(screen.getByTestId('whats-new-backdrop'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'C’est noté' }));
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('garde le clavier dans la fenêtre', async () => {
    render(
      <>
        <button type="button">Dehors</button>
        <WhatsNewDialog releases={[v210]} onClose={vi.fn()} />
      </>
    );
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'C’est noté' })).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Fermer' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'C’est noté' })).toHaveFocus();
  });
});
