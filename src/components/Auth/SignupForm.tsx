// Formulaire d'inscription
// Valide localement les mots de passe puis appelle signUp du contexte d'auth
import { useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { describeAuthError } from '../../utils/authErrors';

export function SignupForm({ onToggle }: { onToggle: () => void }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Soumet le formulaire d'inscription
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      setError(describeAuthError(error, `L'inscription a échoué : ${error.message}`));
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  // Écran de succès après création
  if (success) {
    return (
      <div className="w-full max-w-md mx-auto p-8 panel">
        <h2 className="text-2xl text-ink mb-4">Compte créé !</h2>
        <p className="text-muted mb-6">
          Votre compte a été créé avec succès. Si un e-mail de confirmation vous a été envoyé,
          cliquez sur le lien qu'il contient, puis connectez-vous.
        </p>
        <button
          onClick={onToggle}
          className="w-full py-2 px-4 btn-primary font-medium rounded-md"
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 panel">
      <h2 className="text-2xl text-ink mb-6">Créer un compte</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 field-input"
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label mb-1">
            Mot de passe
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 field-input"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="field-label mb-1">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 field-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 btn-primary font-medium rounded-md"
        >
          {loading ? 'Création...' : 'Créer un compte'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Déjà un compte ?{' '}
        <button onClick={onToggle} className="text-primary-600 hover:text-primary-700 font-medium">
          Se connecter
        </button>
      </p>
    </div>
  );
}
