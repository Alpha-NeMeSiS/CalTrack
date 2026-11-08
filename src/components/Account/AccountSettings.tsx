// Compte et sécurité : appareils connectés, export des données et suppression
// du compte (droits RGPD d'accès / portabilité et d'effacement). L'email et le
// mot de passe se modifient dans « Mon profil ».
import { FormEvent, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { downloadJson, exportUserData } from '../../services/account';
import { getTodayDate } from '../../utils/date';
import { deleteAllProfilePhotos } from '../../services/profilePhoto';
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
    // Les photos de profil (stockage) ne sont pas supprimées par la cascade SQL
    await deleteAllProfilePhotos(user.id).catch(() => undefined);
    const { error } = await deleteAccount();
    // En cas de succès, la déconnexion démonte cette page : rien d'autre à faire.
    if (error) {
      console.error('Error deleting account:', error);
      setDeleteError("La suppression a échoué. Aucune donnée n'a été effacée. Réessayez plus tard.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <SignOutEverywhere />

      <section aria-labelledby="account-export-title" className="space-y-3 border-t border-gray-200 pt-6">
        <h2 id="account-export-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Download className="w-5 h-5 text-gray-500" aria-hidden="true" />
          Exporter mes données
        </h2>
        <p className="text-sm text-gray-600">
          Téléchargez un fichier JSON contenant votre profil, vos objectifs, vos cibles quotidiennes, votre journal
          alimentaire, vos pesées, vos aliments personnels, vos favoris et vos paramètres.
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          {exporting ? 'Préparation…' : 'Télécharger mes données'}
        </button>
        {exportMessage && (
          <p
            role={exportMessage.type === 'error' ? 'alert' : 'status'}
            className={`text-sm ${exportMessage.type === 'error' ? 'text-red-700' : 'text-green-700'}`}
          >
            {exportMessage.text}
          </p>
        )}
      </section>

      <section aria-labelledby="account-delete-title" className="space-y-3 border-t border-gray-200 pt-6">
        <h2 id="account-delete-title" className="flex items-center gap-2 text-lg font-semibold text-red-700">
          <Trash2 className="w-5 h-5" aria-hidden="true" />
          Supprimer mon compte
        </h2>
        <p className="text-sm text-gray-600">
          La suppression est <strong>définitive</strong> : votre compte et toutes vos données (profil, objectifs,
          journal, pesées, aliments personnels) seront effacés. Pensez à exporter vos données avant.
        </p>
        <form onSubmit={handleDelete} className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
          <label htmlFor="delete-confirmation" className="block text-sm text-red-800">
            Pour confirmer, saisissez <span className="font-mono font-semibold">{DELETE_CONFIRMATION_WORD}</span>
          </label>
          <input
            id="delete-confirmation"
            type="text"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full px-3 py-2 border border-red-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {deleteError && (
            <p role="alert" className="text-sm text-red-700">
              {deleteError}
            </p>
          )}
          <button
            type="submit"
            disabled={deleting || confirmation.trim() !== DELETE_CONFIRMATION_WORD}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-md transition-colors"
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement mon compte'}
          </button>
        </form>
      </section>
    </div>
  );
}
