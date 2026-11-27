// Compte et sécurité : appareils connectés, export des données et suppression
// du compte (droits RGPD d'accès / portabilité et d'effacement). L'email et le
// mot de passe se modifient dans « Mon profil ».
import { FormEvent, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../app/contexts/useAuth';
import { downloadJson, exportUserData } from './account.service';
import { getTodayDate } from '../../shared/date';
import { deleteAllProfilePhotos } from '../profile/profilePhoto.service';
import { SignOutEverywhere } from './SignOutEverywhere';

/** Mot à recopier pour confirmer la suppression */
export const DELETE_CONFIRMATION_WORD = 'SUPPRIMER';

export function AccountSettings() {
  const { user, deleteAccount } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) return null;

  const handleExport = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const data = await exportUserData(user);
      downloadJson(`caltrack-export-${getTodayDate()}.json`, data);
      setExportMessage({
        type: 'success',
        text: `Export prêt : ${data.entries.length} aliment(s) du journal, ${data.weight_logs.length} pesée(s), ${data.goals.length} objectif(s).`,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportMessage({ type: 'error', text: "L'export a échoué. Vérifiez votre connexion puis réessayez." });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation.trim() !== DELETE_CONFIRMATION_WORD) return;

    setDeleting(true);
    setDeleteError('');

    // Les photos de profil (stockage) ne sont pas supprimées par la cascade SQL,
    // et il faut une session valide pour y toucher : on les retire AVANT le
    // compte. Audit A-26 : l'échec était avalé, laissant un fichier sans
    // propriétaire dans le stockage (RGPD). On arrête maintenant la suppression
    // plutôt que d'abandonner un fichier derrière soi.
    try {
      await deleteAllProfilePhotos(user.id);
    } catch (photoError) {
      console.error('Error deleting profile photos:', photoError);
      setDeleteError(
        "Vos photos n'ont pas pu être supprimées, le compte n'a donc pas été supprimé. " +
          'Vérifiez votre connexion puis réessayez.'
      );
      setDeleting(false);
      return;
    }

    const { error } = await deleteAccount();
    // En cas de succès, la déconnexion démonte cette page : rien d'autre à faire.
    if (error) {
      console.error('Error deleting account:', error);
      // Les photos ont déjà été supprimées : le message ne promet plus que
      // « aucune donnée » n'a été effacée, ce qui serait faux.
      setDeleteError(
        'La suppression du compte a échoué. Vos données de suivi sont intactes. Réessayez plus tard.'
      );
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SignOutEverywhere />

      <section aria-labelledby="account-export-title" className="space-y-3 border-t border-line pt-6">
        <h2 id="account-export-title" className="flex items-center gap-2 card-title">
          <Download className="w-5 h-5 text-subtle" aria-hidden="true" />
          Exporter mes données
        </h2>
        <p className="text-sm text-muted">
          Téléchargez un fichier JSON contenant votre profil, vos objectifs, vos cibles quotidiennes, votre journal
          alimentaire, vos pesées, vos aliments personnels, vos favoris et vos paramètres.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 py-2 px-4 btn-secondary rounded-md font-medium disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {exporting ? 'Préparation…' : 'Télécharger mes données'}
        </button>
        {exportMessage && (
          <p
            role={exportMessage.type === 'error' ? 'alert' : 'status'}
            className={`text-sm ${exportMessage.type === 'error' ? 'text-danger-700' : 'text-success-700'}`}
          >
            {exportMessage.text}
          </p>
        )}
      </section>

      <section aria-labelledby="account-delete-title" className="space-y-3 border-t border-line pt-6">
        <h2 id="account-delete-title" className="flex items-center gap-2 text-danger-700 card-title">
          <Trash2 className="w-5 h-5" aria-hidden="true" />
          Supprimer mon compte
        </h2>
        <p className="text-sm text-muted">
          La suppression est <strong>définitive</strong> : votre compte et toutes vos données (profil, objectifs,
          journal, pesées, aliments personnels) seront effacés. Pensez à exporter vos données avant.
        </p>
        <form onSubmit={handleDelete} className="space-y-3 rounded-md border border-danger-200 bg-danger-50 p-4">
          <label htmlFor="delete-confirmation" className="block text-sm text-danger-800">
            Pour confirmer, saisissez <span className="font-mono font-semibold">{DELETE_CONFIRMATION_WORD}</span>
          </label>
          <input
            id="delete-confirmation"
            type="text"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full px-3 py-2 border border-danger-300 rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-danger-500"
          />
          {deleteError && (
            <p role="alert" className="text-sm text-danger-700">
              {deleteError}
            </p>
          )}
          <button
            type="submit"
            disabled={deleting || confirmation.trim() !== DELETE_CONFIRMATION_WORD}
            className="w-full py-2 px-4 btn-danger font-medium rounded-md"
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement mon compte'}
          </button>
        </form>
      </section>
    </div>
  );
}
