// Mon profil → Identité : photo de profil, prénom et nom.
import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { Camera, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { removeProfilePhoto, uploadProfilePhoto } from '../../services/profilePhoto';
import { getDisplayName } from '../../utils/avatar';
import { Avatar } from './Avatar';

export const NAME_MAX_LENGTH = 50;

export function IdentityCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [savingNames, setSavingNames] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user || !profile) return null;

  const handleSaveNames = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length > NAME_MAX_LENGTH || last.length > NAME_MAX_LENGTH) {
      setMessage({ type: 'error', text: `Le prénom et le nom ne doivent pas dépasser ${NAME_MAX_LENGTH} caractères.` });
      return;
    }

    setSavingNames(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: first || null, last_name: last || null, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      setMessage({ type: 'success', text: 'Nom enregistré.' });
    } catch (error) {
      console.error('Error saving names:', error);
      setMessage({ type: 'error', text: "Le nom n'a pas pu être enregistré. Réessayez." });
    } finally {
      setSavingNames(false);
    }
  };

  const runPhotoAction = async (action: () => Promise<unknown>, success: string) => {
    setPhotoBusy(true);
    setMessage(null);
    try {
      await action();
      await refreshProfile();
      setMessage({ type: 'success', text: success });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Une erreur est survenue.' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de choisir à nouveau le même fichier
    if (!file) return;
    runPhotoAction(() => uploadProfilePhoto(user.id, file, profile.profile_picture_url), 'Photo mise à jour.');
  };

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section aria-label="Identité" className="space-y-5 rounded-lg bg-white p-4 shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar identity={profile} className="h-20 w-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium text-gray-900">{getDisplayName(profile)}</p>
          <p className="truncate text-sm text-gray-500">{profile.email}</p>
          {profile.created_at && (
            <p className="text-sm text-gray-500">
              Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="sr-only"
            aria-label="Choisir une photo de profil"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={photoBusy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {photoBusy ? 'Envoi…' : profile.profile_picture_url ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {profile.profile_picture_url && (
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => runPhotoAction(() => removeProfilePhoto(user.id, profile.profile_picture_url), 'Photo retirée.')}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Retirer
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveNames} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="first_name" className="mb-1 block text-sm font-medium text-gray-700">
            Prénom
          </label>
          <input
            id="first_name"
            type="text"
            autoComplete="given-name"
            maxLength={NAME_MAX_LENGTH}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="last_name" className="mb-1 block text-sm font-medium text-gray-700">
            Nom
          </label>
          <input
            id="last_name"
            type="text"
            autoComplete="family-name"
            maxLength={NAME_MAX_LENGTH}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={savingNames}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {savingNames ? 'Enregistrement…' : 'Enregistrer le nom'}
        </button>
      </form>

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.type === 'error' ? 'text-red-700' : 'text-green-700'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
