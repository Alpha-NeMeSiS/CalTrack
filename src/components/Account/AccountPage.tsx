// Page « Compte et sécurité » (menu du compte) : mot de passe, export des
// données et suppression du compte.
import { AccountSettings } from './AccountSettings';

export function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl text-ink">Compte et sécurité</h1>
      <div className="panel p-4 sm:p-6">
        <AccountSettings />
      </div>
    </div>
  );
}
