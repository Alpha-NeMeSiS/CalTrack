// Page « Compte et sécurité » (menu du compte) : mot de passe, export des
// données et suppression du compte.
import { AccountSettings } from './AccountSettings';

export function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl text-gray-900">Compte et sécurité</h1>
      <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
        <AccountSettings />
      </div>
    </div>
  );
}
