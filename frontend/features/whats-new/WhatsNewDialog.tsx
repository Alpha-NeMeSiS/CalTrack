// Fenêtre « Quoi de neuf ? » : notes des versions (la plus récente en premier).
// Fermée par « C'est noté », la croix ou Échap ; un clic sur le fond ne la ferme pas.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { ReleaseNote } from './releaseNotes';
import { formatDateFR } from '../../shared/timeProgress';
import { parseLocalDate } from '../../shared/date';
import { useModalFocus } from '../../shared/ui/useModalFocus';

interface WhatsNewDialogProps {
  releases: ReleaseNote[];
  onClose: () => void;
  /** Remplace le sous-titre par défaut (ex. historique depuis « À propos ») */
  subtitle?: string;
}

export function WhatsNewDialog({ releases, onClose, subtitle }: WhatsNewDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  // Échap, piège de focus, restauration du focus et verrou du défilement
  useModalFocus(dialogRef, onClose);

  const defaultSubtitle =
    releases.length > 1 ? `${releases.length} mises à jour depuis votre dernière visite` : 'CalTrack a été mis à jour';

  return (
    <div
      data-testid="whats-new-backdrop"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="bg-surface rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="whats-new-title" className="card-title">
              Quoi de neuf ?
            </h2>
            <p className="mt-1 text-xs text-subtle">{subtitle ?? defaultSubtitle}</p>
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

        {releases.map((release, index) => (
          <section
            key={release.version}
            aria-label={`Version ${release.version}`}
            className={`space-y-2 ${index > 0 ? 'border-t border-line pt-4' : ''}`}
          >
            <p className="section-label">
              Version {release.version} · {formatDateFR(parseLocalDate(release.date))}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-body">
              {release.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <div className="flex justify-end pt-1">
          <button ref={confirmRef} type="button" onClick={onClose} className="btn-brand">
            C’est noté
          </button>
        </div>
      </div>
    </div>
  );
}
