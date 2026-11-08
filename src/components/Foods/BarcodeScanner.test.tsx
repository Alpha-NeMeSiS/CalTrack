import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeScanner } from './BarcodeScanner';
import type { CodeDetector } from '../../lib/barcodeDetector';

const stopTrack = vi.fn();
const getUserMedia = vi.fn();
const fakeStream = {
  getTracks: () => [{ stop: stopTrack }],
} as unknown as MediaStream;

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  getUserMedia.mockResolvedValue(fakeStream);
  setMediaDevices({ getUserMedia });
  // jsdom ne lit pas les vidéos : on simule une image prête
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
});

afterEach(() => {
  setMediaDevices(undefined);
});

const detectorReturning = (...reads: string[][]): CodeDetector => {
  const detect = vi.fn();
  reads.forEach((codes) => detect.mockResolvedValueOnce(codes.map((rawValue) => ({ rawValue }))));
  detect.mockResolvedValue([]);
  return { detect };
};

describe('BarcodeScanner', () => {
  it('ouvre la caméra arrière et renvoie le code détecté', async () => {
    const onDetected = vi.fn();
    render(
      <BarcodeScanner
        onDetected={onDetected}
        onCancel={vi.fn()}
        createDetector={async () => detectorReturning(['3017620422003'])}
      />,
    );

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith('3017620422003'));
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: { ideal: 'environment' },
        }),
      }),
    );
    // La caméra est coupée dès que le code est lu
    expect(stopTrack).toHaveBeenCalled();
  });

  it('ignore les lectures dont la clé de contrôle est fausse', async () => {
    const onDetected = vi.fn();
    const detector = detectorReturning(['3017620422004'], ['96385074']);
    render(<BarcodeScanner onDetected={onDetected} onCancel={vi.fn()} createDetector={async () => detector} />);

    await waitFor(() => expect(onDetected).toHaveBeenCalledWith('96385074'), {
      timeout: 2000,
    });
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(detector.detect).toHaveBeenCalledTimes(2);
  });

  it('propose la saisie manuelle si la caméra est refusée', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const onDetected = vi.fn();
    render(
      <BarcodeScanner onDetected={onDetected} onCancel={vi.fn()} createDetector={async () => detectorReturning()} />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Accès à la caméra refusé');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ou saisissez le code-barres'), '3 017620 422003');
    await user.click(screen.getByRole('button', { name: 'Chercher' }));
    expect(onDetected).toHaveBeenCalledWith('3017620422003');
  });

  it('refuse un code saisi invalide', async () => {
    const onDetected = vi.fn();
    render(
      <BarcodeScanner onDetected={onDetected} onCancel={vi.fn()} createDetector={async () => detectorReturning()} />,
    );

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Ou saisissez le code-barres'), '3017620422004');
    await user.click(screen.getByRole('button', { name: 'Chercher' }));

    expect(screen.getByText(/Code-barres invalide/)).toBeInTheDocument();
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('ne soumet pas le formulaire parent (fenêtre d’ajout)', async () => {
    const parentSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onDetected = vi.fn();
    render(
      <form onSubmit={parentSubmit}>
        <BarcodeScanner onDetected={onDetected} onCancel={vi.fn()} createDetector={async () => detectorReturning()} />
      </form>
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Ou saisissez le code-barres'), '3017620422004{Enter}');
    expect(screen.getByText(/Code-barres invalide/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Ou saisissez le code-barres'));
    await user.type(screen.getByLabelText('Ou saisissez le code-barres'), '96385074');
    await user.click(screen.getByRole('button', { name: 'Chercher' }));

    expect(onDetected).toHaveBeenCalledWith('96385074');
    expect(parentSubmit).not.toHaveBeenCalled();
    // Pas de <form> imbriqué (HTML invalide)
    expect(document.querySelectorAll('form form')).toHaveLength(0);
  });

  it('explique quand le navigateur n’a pas accès à la caméra', async () => {
    setMediaDevices(undefined);
    render(<BarcodeScanner onDetected={vi.fn()} onCancel={vi.fn()} createDetector={async () => detectorReturning()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('caméra n’est pas disponible');
  });

  it('coupe la caméra si le lecteur ne se charge pas', async () => {
    render(
      <BarcodeScanner
        onDetected={vi.fn()}
        onCancel={vi.fn()}
        createDetector={async () => {
          throw new Error('wasm');
        }}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('lecteur de code-barres n’a pas pu se charger');
    expect(stopTrack).toHaveBeenCalled();
  });

  it('coupe la caméra en annulant', async () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <BarcodeScanner onDetected={vi.fn()} onCancel={onCancel} createDetector={async () => detectorReturning()} />,
    );
    expect(await screen.findByText('Placez le code-barres dans le cadre')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Annuler le scan' }));
    expect(onCancel).toHaveBeenCalled();

    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });
});
