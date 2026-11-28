import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('rendu impossible');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // React écrit l'erreur rattrapée dans la console : attendu, on la masque
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche les enfants quand tout va bien', () => {
    render(
      <AppErrorBoundary>
        <p>Mon journal</p>
      </AppErrorBoundary>
    );
    expect(screen.getByText('Mon journal')).toBeInTheDocument();
  });

  it("affiche un message et un bouton de rechargement au lieu d'une page blanche", () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Une erreur est survenue');
    expect(alert).toHaveTextContent('Vos données sont intactes');
    expect(screen.getByRole('button', { name: 'Recharger CalTrack' })).toBeInTheDocument();
  });

  it('recharge la page au clic', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Recharger CalTrack' }));
    expect(reload).toHaveBeenCalled();
  });

  it('signale l’erreur rattrapée', () => {
    const onError = vi.fn();
    render(
      <AppErrorBoundary onError={onError}>
        <Boom />
      </AppErrorBoundary>
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'rendu impossible' }),
      expect.anything()
    );
  });
});
