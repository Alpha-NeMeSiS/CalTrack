// Détecteur de codes-barres pour le scanner de l'ajout d'aliment.
//
// On utilise le BarcodeDetector natif du navigateur quand il existe (Chrome
// Android, macOS…). Sinon (iPhone, Firefox, Chrome sur PC), on charge à la
// demande le « ponyfill » barcode-detector, basé sur ZXing compilé en
// WebAssembly. Le fichier .wasm (~1 Mo) est servi par l'application elle-même
// (pas de CDN tiers) et n'est téléchargé qu'à la première ouverture du scanner.

/** Formats des produits alimentaires (GTIN) */
export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'];

export type DetectedCode = { rawValue: string; format?: string };

export interface CodeDetector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>;
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): CodeDetector;
  getSupportedFormats?: () => Promise<readonly string[]>;
};

async function nativeDetector(): Promise<CodeDetector | null> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = (await Native.getSupportedFormats?.()) ?? [];
    if (!SCAN_FORMATS.every((format) => supported.includes(format))) return null;
    return new Native({ formats: SCAN_FORMATS });
  } catch {
    return null;
  }
}

let ponyfillReady: Promise<BarcodeDetectorConstructor> | null = null;

/** Charge le ponyfill et son .wasm une seule fois (réessaie après un échec). */
function loadPonyfill(): Promise<BarcodeDetectorConstructor> {
  ponyfillReady ??= (async () => {
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ]);
    // Instancie le module tout de suite : une erreur de chargement du .wasm
    // est signalée ici plutôt qu'à la première image analysée.
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
      },
      fireImmediately: true,
    });
    return BarcodeDetector as unknown as BarcodeDetectorConstructor;
  })().catch((error) => {
    ponyfillReady = null;
    throw error;
  });
  return ponyfillReady;
}

/** Crée un détecteur limité aux codes-barres des produits. */
export async function createBarcodeDetector(): Promise<CodeDetector> {
  const native = await nativeDetector();
  if (native) return native;
  const Ponyfill = await loadPonyfill();
  return new Ponyfill({ formats: SCAN_FORMATS });
}
