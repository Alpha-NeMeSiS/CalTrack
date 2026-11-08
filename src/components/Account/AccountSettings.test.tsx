import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSettings, DELETE_CONFIRMATION_WORD } from './AccountSettings';

const deleteAccount = vi.fn();
const exportUserData = vi.fn();
const downloadJson = vi.fn();

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'eva@example.com' },
    deleteAccount,
    updatePassword: vi.fn(),
  }),
}));

vi.mock('../../services/account', () => ({
  exportUserData: (...args: unknown[]) => exportUserData(...args),
  downloadJson: (...args: unknown[]) => downloadJson(...args),
}));

beforeEach(() => {
  deleteAccount.mockReset();
  exportUserData.mockReset();
  downloadJson.mockReset();
});

describe('AccountSettings', () => {
  it("télécharge l'export JSON des données", async () => {
    exportUserData.mockResolvedValue({ entries: [{}, {}], weight_logs: [{}], goals: [{}] });
    render(<AccountSettings />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Télécharger mes données' }));

    expect(exportUserData).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }));
    expect(downloadJson).toHaveBeenCalledWith(
      expect.stringMatching(/^caltrack-export-\d{4}-\d{2}-\d{2}\.json$/),
      expect.objectContaining({ entries: expect.any(Array) })
    );
    expect(await screen.findByRole('status')).toHaveTextContent('2 aliment(s) du journal, 1 pesée(s), 1 objectif(s)');
  });

  it("signale l'échec de l'export", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    exportUserData.mockRejectedValue(new Error('réseau'));
    render(<AccountSettings />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Télécharger mes données' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("L'export a échoué");
    expect(downloadJson).not.toHaveBeenCalled();
  });

  it('exige de recopier le mot de confirmation avant de supprimer le compte', async () => {
    deleteAccount.mockResolvedValue({ error: null });
    render(<AccountSettings />);
    const user = userEvent.setup();
    const deleteButton = screen.getByRole('button', { name: 'Supprimer définitivement mon compte' });

    expect(deleteButton).toBeDisabled();
    await user.type(screen.getByLabelText(/Pour confirmer/), 'supprimer');
    expect(deleteButton).toBeDisabled();

    await user.clear(screen.getByLabelText(/Pour confirmer/));
    await user.type(screen.getByLabelText(/Pour confirmer/), DELETE_CONFIRMATION_WORD);
    await user.click(deleteButton);

    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('affiche une erreur si la suppression échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteAccount.mockResolvedValue({ error: new Error('permission denied') });
    render(<AccountSettings />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Pour confirmer/), DELETE_CONFIRMATION_WORD);
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement mon compte' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Aucune donnée n'a été effacée");
    expect(screen.getByRole('button', { name: 'Supprimer définitivement mon compte' })).toBeEnabled();
  });
});
