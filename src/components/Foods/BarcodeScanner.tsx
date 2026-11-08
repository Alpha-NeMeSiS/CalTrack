// Scanner de code-barres : aperçu de la caméra arrière et lecture du code
// (BarcodeDetector natif ou ponyfill ZXing, voir src/lib/barcodeDetector.ts).
// La saisie du code à la main reste toujours possible (caméra refusée,
// code abîmé, ordinateur sans caméra).
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CodeDetector, createBarcodeDetector } from '../../lib/barcodeDetector';
import { cleanBarcodeInput, isValidGtin } from '../../utils/barcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
  /** Remplaçable dans les tests */
  createDetector?: () => Promise<CodeDetector>;
}

/** Intervalle entre deux analyses d'image (ms) */
const SCAN_INTERVAL_MS = 200;

type Status = 'starting' | 'scanning' | 'error';

function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code ci-dessous.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Aucune caméra trouvée sur cet appareil. Saisissez le code ci-dessous.';
  }
  if (name === 'NotReadableError') {
    return 'La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez, ou saisissez le code.';
  }
  return 'La caméra n’a pas pu démarrer. Saisissez le code ci-dessous.';
}

export function BarcodeScanner({ onDetected, onCancel, createDetector = createBarcodeDetector }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState('');

  // Les callbacks peuvent changer à chaque rendu du parent : on garde la
  // dernière version sans relancer la caméra.
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const createDetectorRef = useRef(createDetector);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;

    const stopCamera = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const fail = (message: string) => {
      stopCamera();
      setCameraError(message);
      setStatus('error');
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('La caméra n’est pas disponible dans ce navigateur. Saisissez le code ci-dessous.');
        return;
      }

      // Le lecteur se charge pendant que l'utilisateur autorise la caméra
      const detectorPromise = createDetectorRef.current();
      detectorPromise.catch(() => undefined);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (error) {
        if (!stopped) fail(cameraErrorMessage(error));
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }

      let detector: CodeDetector;
      try {
        detector = await detectorPromise;
      } catch {
        if (!stopped)
          fail(
            'Le lecteur de code-barres n’a pas pu se charger. Vérifiez votre connexion, ou saisissez le code ci-dessous.',
          );
        return;
      }
      if (stopped) return;
      setStatus('scanning');

      const scan = async () => {
        if (stopped) return;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const code = codes.map((item) => item.rawValue.trim()).find(isValidGtin);
            if (code && !stopped) {
              stopCamera();
              navigator.vibrate?.(80);
              onDetectedRef.current(code);
              return;
            }
          } catch {
            // Image pas encore disponible : on réessaie à la prochaine analyse
          }
        }
        if (!stopped) timer = window.setTimeout(scan, SCAN_INTERVAL_MS);
      };
      scan();
    })();

    return stopCamera;
  }, []);

  // Pas de <form> ici : le scanner est affiché dans le formulaire de la fenêtre
  // d'ajout (des formulaires imbriqués sont invalides et l'envoi remonterait).
  const submitManualCode = () => {
    const code = cleanBarcodeInput(manualCode);
    if (!isValidGtin(code)) {
      setManualError('Code-barres invalide : saisissez les 8, 12 ou 13 chiffres sous les barres.');
      return;
    }
    setManualError('');
    onDetected(code);
  };

  return (
    <section aria-labelledby="barcode-scanner-title" className="space-y-3 rounded-md border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="barcode-scanner-title" className="text-sm font-semibold text-ink">
          Scanner un code-barres
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Annuler le scan"
          className="rounded-md p-1 text-subtle hover:bg-surface-sunken hover:text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {status === 'error' ? (
        <p role="alert" className="rounded-md border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
          {cameraError}
        </p>
      ) : (
        <div className="relative aspect-[4/3] max-h-[45vh] w-full overflow-hidden rounded-md bg-[#000] sm:aspect-video">
          {/* Couleurs fixes : bg-black / text-on-color sont inversés par le thème sombre */}
          <video ref={videoRef} muted playsInline autoPlay aria-hidden="true" className="h-full w-full object-cover" />
          {/* Cadre de visée */}
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-28 -translate-y-1/2 rounded-lg border-2 border-[rgba(255,255,255,0.85)] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          <p
            role="status"
            className="absolute inset-x-0 bottom-2 px-3 text-center text-sm font-medium text-[#fff] drop-shadow"
          >
            {status === 'starting' ? 'Ouverture de la caméra…' : 'Placez le code-barres dans le cadre'}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="barcode-manual" className="block text-xs font-medium text-muted">
          Ou saisissez le code-barres
        </label>
        <div className="flex gap-2">
          <input
            id="barcode-manual"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="ex. 3017620422003"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (manualCode.trim()) submitManualCode();
              }
            }}
            aria-invalid={manualError ? true : undefined}
            aria-describedby={manualError ? 'barcode-manual-error' : undefined}
            className="min-w-0 flex-1 field-input px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitManualCode}
            disabled={!manualCode.trim()}
            className="rounded-md btn-primary px-3 py-2 text-sm font-medium"
          >
            Chercher
          </button>
        </div>
        {manualError && (
          <p id="barcode-manual-error" className="text-xs text-danger-700">
            {manualError}
          </p>
        )}
      </div>
    </section>
  );
}
