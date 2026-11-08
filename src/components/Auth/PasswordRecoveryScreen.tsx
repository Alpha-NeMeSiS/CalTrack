// Écran affiché après un clic sur le lien « mot de passe oublié » reçu par email.
// Supabase a ouvert une session temporaire : l'utilisateur choisit son nouveau
// mot de passe puis continue vers l'application.
import { useAuth } from '../../contexts/useAuth';
import { NewPasswordForm } from './NewPasswordForm';

export function PasswordRecoveryScreen() {
  const { user, dismissPasswordRecovery } = useAuth();

  return (
    <div className="w-full max-w-md mx-auto p-8 panel">
      <h2 className="text-2xl font-bold text-ink mb-2">Nouveau mot de passe</h2>
      <p className="text-sm text-muted mb-6">
        Choisissez le nouveau mot de passe de votre compte{user?.email ? ` (${user.email})` : ''}.
      </p>

      <NewPasswordForm submitLabel="Enregistrer et continuer" />

      <p className="mt-4 text-center text-sm">
        <button
          type="button"
          onClick={dismissPasswordRecovery}
          className="text-muted hover:text-ink"
        >
          Plus tard
        </button>
      </p>
    </div>
  );
}
