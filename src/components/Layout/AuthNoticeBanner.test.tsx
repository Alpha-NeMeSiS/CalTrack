import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthNoticeBanner } from './AuthNoticeBanner';
import type { AuthNotice } from '../../utils/authRedirect';

const authValue = { authNotice: null as AuthNotice | null, dismissAuthNotice: vi.fn() };
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => authValue }));

describe('AuthNoticeBanner', () => {
  it("n'affiche rien sans message", () => {
    authValue.authNotice = null;
    const { container } = render(<AuthNoticeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche une erreur et se ferme', async () => {
    authValue.authNotice = { type: 'error', text: 'Ce lien a expiré.' };
    render(<AuthNoticeBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ce lien a expiré.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Fermer le message' }));
    expect(authValue.dismissAuthNotice).toHaveBeenCalled();
  });
});
