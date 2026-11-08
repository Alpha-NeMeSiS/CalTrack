// Choix d'un nouveau mot de passe.
// Utilisé après le lien « mot de passe oublié » (écran plein) et dans
// Paramètres → Compte (changement de mot de passe).
import { FormEvent, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';

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
      setError(`Le mot de passe n'a pas pu être modifié : ${error.message}`);
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
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          Mot de passe modifié.
        </div>
      )}

      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          id="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">Au moins {MIN_PASSWORD_LENGTH} caractères.</p>
      </div>

      <div>
        <label htmlFor="new-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          id="new-password-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
      >
        {loading ? 'Enregistrement…' : submitLabel}
      </button>
    </form>
  );
}
