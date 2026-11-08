// Changement d'adresse email. Supabase envoie un lien de confirmation :
// l'adresse ne change qu'après le clic (sur l'ancienne ET la nouvelle adresse
// si le « changement sécurisé » est activé dans Supabase). En attendant,
// user.new_email contient l'adresse demandée.
import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { describeEmailChangeError } from '../../utils/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailChangeForm() {
  const { user, updateEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) return null;
  const currentEmail = user.email ?? '';
  const pendingEmail = user.new_email && user.new_email !== currentEmail ? user.new_email : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const next = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(next)) {
      setMessage({ type: 'error', text: 'Saisissez une adresse email valide.' });
      return;
    }
    if (next === currentEmail.toLowerCase()) {
      setMessage({ type: 'error', text: 'C’est déjà l’adresse de votre compte.' });
      return;
    }

    setSaving(true);
    const { error } = await updateEmail(next);
    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: describeEmailChangeError(error) });
      return;
    }
    setEmail('');
    setMessage({
      type: 'success',
      text: `Un lien de confirmation a été envoyé à ${next}. Votre adresse ne changera qu’après avoir cliqué dessus (pensez aussi à vérifier votre adresse actuelle).`,
    });
  };

  return (
    <section aria-labelledby="account-email-title" className="space-y-3">
      <h2 id="account-email-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Mail className="h-5 w-5 text-gray-500" aria-hidden="true" />
        Adresse email
      </h2>
      <p className="text-sm text-gray-600">
        Adresse actuelle : <span className="font-medium text-gray-900">{currentEmail}</span>
      </p>

      {pendingEmail && !message && (
        <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Changement en attente vers <span className="font-medium">{pendingEmail}</span> : confirmez-le depuis le lien
          reçu par email.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="new-email" className="mb-1 block text-sm font-medium text-gray-700">
            Nouvelle adresse email
          </label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {message && (
          <p
            role={message.type === 'error' ? 'alert' : 'status'}
            className={`rounded-md border p-3 text-sm ${
              message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
        >
          {saving ? 'Envoi…' : 'Changer d’adresse'}
        </button>
      </form>
    </section>
  );
}
