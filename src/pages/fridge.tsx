import { FridgeCapture } from '../components/Fridge/FridgeCapture';

export default function FridgePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cuisiner avec mon frigo</h1>
        <p className="mt-2 text-gray-600">
          Capturez l'intérieur de votre frigo, ajustez les aliments détectés puis laissez l'IA proposer des idées healthy. Les
          macros resteront calculées à partir de la base d'aliments interne.
        </p>
      </div>
      <FridgeCapture />
    </div>
  );
}
