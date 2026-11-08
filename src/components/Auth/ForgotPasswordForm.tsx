// « Mot de passe oublié » : envoie un lien de réinitialisation par email.
// Le message de confirmation est le même que l'adresse corresponde ou non à un
// compte, pour ne pas révéler quelles adresses sont inscrites.
import { FormEvent, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { describeAuthError } from '../../utils/authErrors';

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onBack: () => void;
}

export function ForgotPasswordForm({ initialEmail = '', onBack }: ForgotPasswordFormProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await requestPasswordReset(email.trim());
    setLoading(false);

    if (error) {
      setError(
        describeAuthError(error, "L'email n'a pas pu être envoyé. Vérifiez l'adresse ou réessayez dans quelques minutes.")
      );
      return;
    }
    setSent(true);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 panel">
      <h2 className="page-title mb-2">Mot de passe oublié</h2>

      {sent ? (
        <div role="status" className="mt-4 p-3 bg-success-50 border border-success-200 text-success-800 rounded-md text-sm">
          Si un compte existe pour <span className="font-medium">{email.trim()}</span>, un email contenant un lien
          de réinitialisation vient d'être envoyé. Pensez à vérifier vos courriers indésirables.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            Saisissez l'adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>

          {error && (
            <div role="alert" className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="reset-email" className="field-label mb-1">
              Email
            </label>
            <input
              type="email"
              id="reset-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 field-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2 px-4 btn-primary font-medium rounded-md"
          >
            {loading ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm">
        <button type="button" onClick={onBack} className="text-primary-700 hover:text-primary-800 font-medium">
          Retour à la connexion
        </button>
      </p>
    </div>
  );
}
