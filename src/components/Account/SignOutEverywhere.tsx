// Déconnexion de tous les appareils : révoque toutes les sessions du compte
// (téléphone, ordinateur…), y compris celle-ci. Confirmation en deux temps.
// Supabase révoque les jetons de rafraîchissement ; un jeton d'accès déjà émis
// reste valable jusqu'à son expiration (1 h par défaut) : le texte le précise.
import { useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';

export function SignOutEverywhere() {
  const { signOutEverywhere } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleConfirm = async () => {
    setSigningOut(true);
    // La déconnexion démonte la page : pas d'état à remettre ensuite
    await signOutEverywhere();
  };

  return (
    <section aria-labelledby="account-sessions-title" className="space-y-3">
      <h2 id="account-sessions-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
        <MonitorSmartphone className="h-5 w-5 text-subtle" aria-hidden="true" />
        Appareils connectés
      </h2>
      <p className="text-sm text-muted">
        Déconnectez CalTrack de tous vos appareils, celui-ci compris : utile si vous avez perdu un téléphone ou si
        vous pensez que quelqu’un d’autre utilise votre compte. Pensez aussi à changer votre mot de passe.
      </p>
      <p className="text-xs text-subtle">
        Cet appareil est déconnecté tout de suite. Une application déjà ouverte sur un autre appareil peut rester
        utilisable jusqu’à l’expiration de sa session en cours (au plus 1 heure), puis elle est déconnectée.
      </p>

      {confirming ? (
        <div role="group" aria-label="Confirmer la déconnexion de tous les appareils" className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={signingOut}
            className="rounded-md bg-ink px-4 py-2 font-medium text-on-color hover:bg-ink/90 disabled:opacity-60"
          >
            {signingOut ? 'Déconnexion…' : 'Oui, me déconnecter partout'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={signingOut}
            className="rounded-md btn-secondary px-4 py-2 font-medium"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md btn-secondary px-4 py-2 font-medium"
        >
          Se déconnecter de tous les appareils
        </button>
      )}
    </section>
  );
}
