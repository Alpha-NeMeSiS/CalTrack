// Formulaire de connexion
// Appelle signIn via le contexte d'auth et affiche les erreurs éventuelles.
// Le lien « Mot de passe oublié ? » affiche le formulaire d'envoi du lien de
// réinitialisation (ForgotPasswordForm).
import { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { describeAuthError } from '../../utils/authErrors';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export function LoginForm({ onToggle }: { onToggle: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Soumet le formulaire de connexion
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(describeAuthError(error, 'La connexion a échoué. Vérifiez votre connexion internet puis réessayez.'));
    }

    setLoading(false);
  };

  if (showForgot) {
    return <ForgotPasswordForm initialEmail={email} onBack={() => setShowForgot(false)} />;
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 panel">
      <h2 className="text-2xl font-bold text-ink mb-6">Connexion</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="field-label mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 field-input"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="field-label">
              Mot de passe
            </label>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-sm text-primary-700 hover:text-primary-800"
            >
              Mot de passe oublié ?
            </button>
          </div>
          <input
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 field-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 btn-primary font-medium rounded-md"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <button onClick={onToggle} className="text-primary-700 hover:text-primary-800 font-medium">
          Créer un compte
        </button>
      </p>
    </div>
  );
}
