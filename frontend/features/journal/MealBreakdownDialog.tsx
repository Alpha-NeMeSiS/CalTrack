// Fenêtre « Détail par repas » : ce que chaque repas a apporté dans la journée
// (kcal, part des kcal du jour, protéines, lipides, glucides, fibres).
// Ouverte par le bouton « Détail » du bloc calories + macros du journal.
import { useRef } from 'react';
import { X } from 'lucide-react';
import type { MealBreakdown, MealTotals } from './entries';
import { useModalFocus } from '../../shared/ui/useModalFocus';

interface MealBreakdownDialogProps {
  breakdown: MealBreakdown;
  /** Date affichée sous le titre, ex. « vendredi 28 novembre » */
  dateLabel: string;
  onClose: () => void;
}

/** Colonnes de macros : abrégées à l'écran (téléphone), en entier pour les lecteurs d'écran */
const MACRO_COLUMNS: { key: keyof Omit<MealTotals, 'kcal'>; short: string; full: string }[] = [
  { key: 'protein_g', short: 'Prot.', full: 'Protéines' },
  { key: 'fat_g', short: 'Lip.', full: 'Lipides' },
  { key: 'carbs_g', short: 'Gluc.', full: 'Glucides' },
  { key: 'fiber_g', short: 'Fib.', full: 'Fibres' },
];

const cell = 'px-2 py-2 text-right tabular-nums whitespace-nowrap';

export function MealBreakdownDialog({ breakdown, dateLabel, onClose }: MealBreakdownDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Échap, piège de focus, retour du focus au bouton « Détail », page figée
  useModalFocus(dialogRef, onClose);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-breakdown-title"
        className="bg-surface rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="meal-breakdown-title" className="card-title">
              Détail par repas
            </h2>
            <p className="mt-1 text-sm text-subtle first-letter:uppercase">{dateLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-subtle hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Défilement horizontal : un nom de repas personnalisé long ne doit pas
            faire déborder la fenêtre sur un petit écran (320 px). */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-body">
            <caption className="sr-only">Calories et macros de chaque repas de la journée</caption>
            <thead>
              <tr className="border-b border-line text-xs text-subtle">
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Repas
                </th>
                <th scope="col" className={`${cell} font-medium`}>
                  kcal
                </th>
                {MACRO_COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className={`${cell} font-medium`}>
                    <span aria-hidden="true">{column.short}</span>
                    <span className="sr-only">{column.full}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.meals.map((meal) => (
                <tr key={meal.meal} className="border-b border-line-subtle">
                  <th scope="row" className="px-2 py-2 text-left font-medium text-ink">
                    {meal.label}
                  </th>
                  <td className={cell}>
                    {meal.kcal} <span className="text-xs text-subtle">({meal.sharePct} %)</span>
                  </td>
                  {MACRO_COLUMNS.map((column) => (
                    <td key={column.key} className={cell}>
                      {meal[column.key]} g
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-ink">
                <th scope="row" className="px-2 py-2 text-left">
                  Total
                </th>
                <td className={cell}>{breakdown.total.kcal}</td>
                {MACRO_COLUMNS.map((column) => (
                  <td key={column.key} className={cell}>
                    {breakdown.total[column.key]} g
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
