// Choix d'un nouveau mot de passe.
// Utilisé après le lien « mot de passe oublié » (écran plein) et dans
// Paramètres → Compte (changement de mot de passe).
import { FormEvent, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { describeAuthError } from '../../utils/authErrors';

export const MIN_PASSWORD_LENGTH = 6;

interface NewPasswordFormProps {
  /** Appelé après l'enregistrement réussi du mot de passe */
  onDone?: () => void;
  submitLabel?: string;
}

export function NewPasswordForm({ onDone, submitLabel = 'Enregistrer le mot de passe' }: NewPasswordFormProps) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError(describeAuthError(error, `Le mot de passe n'a pas pu être modifié : ${error.message}`));
      return;
    }
    setPassword('');
    setConfirm('');
    setSuccess(true);
    onDone?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Changement de mot de passe">
      {error && (
        <div role="alert" className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="p-3 bg-success-50 border border-success-200 text-success-700 rounded-md text-sm">
          Mot de passe modifié.
        </div>
      )}

      <div>
        <label htmlFor="new-password" className="field-label mb-1">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          id="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 field-input"
        />
        <p className="mt-1 text-xs text-subtle">Au moins {MIN_PASSWORD_LENGTH} caractères.</p>
      </div>

      <div>
        <label htmlFor="new-password-confirm" className="field-label mb-1">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          id="new-password-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="w-full px-3 py-2 field-input"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full py-2 px-4 btn-primary font-medium rounded-md"
      >
        {loading ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  );
}
