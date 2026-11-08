// Message affiché au retour d'un lien d'authentification envoyé par email
// (lien expiré, première étape d'un changement d'email, adresse confirmée…).
// Visible sur tous les écrans, connecté ou non, jusqu'à sa fermeture.
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

const STYLES = {
  success: { box: 'border-success-200 bg-success-50 text-success-800', Icon: CheckCircle2 },
  info: { box: 'border-info-200 bg-info-50 text-info-800', Icon: Info },
  error: { box: 'border-danger-200 bg-danger-50 text-danger-800', Icon: AlertTriangle },
} as const;

export function AuthNoticeBanner() {
  const { authNotice, dismissAuthNotice } = useAuth();
  if (!authNotice) return null;

  const { box, Icon } = STYLES[authNotice.type];
  return (
    <div
      role={authNotice.type === 'error' ? 'alert' : 'status'}
      className={`fixed left-1/2 top-3 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ${box}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="flex-1">{authNotice.text}</p>
      <button
        type="button"
        onClick={dismissAuthNotice}
        aria-label="Fermer le message"
        className="-m-1 rounded p-1 hover:bg-black/5"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
