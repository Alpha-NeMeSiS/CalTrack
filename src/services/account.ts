// Données du compte (RGPD) : export de toutes les données de l'utilisateur.
// La suppression du compte passe par AuthContext.deleteAccount (fonction SQL
// delete_my_account, voir supabase/migrations).
import { supabase } from '../lib/supabase';

/** Taille de page : Supabase limite le nombre de lignes renvoyées par requête. */
export const EXPORT_PAGE_SIZE = 1000;

/** Tables exportées : colonne du propriétaire, colonne de tri (pagination stable)
 *  et colonnes lues (les recettes avec leurs ingrédients). */
const USER_TABLES = [
  { table: 'goals', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'daily_targets', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'entries', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'weight_logs', ownerColumn: 'user_id', orderColumn: 'id' },
  // Aliments personnels uniquement (les aliments de base ont user_id NULL)
  { table: 'foods', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'user_preferences', ownerColumn: 'user_id', orderColumn: 'user_id' },
  { table: 'push_subscriptions', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'favorite_foods', ownerColumn: 'user_id', orderColumn: 'id' },
  { table: 'recipes', ownerColumn: 'user_id', orderColumn: 'id', select: '*, recipe_ingredients(*)' },
  { table: 'water_logs', ownerColumn: 'user_id', orderColumn: 'id' },
] as const;

type ExportedTable = (typeof USER_TABLES)[number]['table'];

export type UserDataExport = {
  format: 'caltrack-export';
  version: 1;
  exported_at: string;
  user: { id: string; email: string | null };
  profile: Record<string, unknown> | null;
} & Record<ExportedTable, Record<string, unknown>[]>;

/** Lit toutes les lignes de l'utilisateur dans une table, page par page. */
async function fetchAllRows(table: string, ownerColumn: string, orderColumn: string, userId: string, columns = '*') {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq(ownerColumn, userId)
      .order(orderColumn, { ascending: true })
      .range(from, from + EXPORT_PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data as unknown as Record<string, unknown>[] | null) ?? [];
    rows.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return rows;
  }
}

/** Rassemble toutes les données de l'utilisateur dans un objet JSON. */
export async function exportUserData(
  user: { id: string; email?: string | null },
  now: Date = new Date()
): Promise<UserDataExport> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const tables = await Promise.all(
    USER_TABLES.map(
      async (spec) =>
        [spec.table, await fetchAllRows(spec.table, spec.ownerColumn, spec.orderColumn, user.id, 'select' in spec ? spec.select : '*')] as const
    )
  );

  return {
    format: 'caltrack-export',
    version: 1,
    exported_at: now.toISOString(),
    user: { id: user.id, email: user.email ?? null },
    profile: (profile as Record<string, unknown> | null) ?? null,
    ...(Object.fromEntries(tables) as Record<ExportedTable, Record<string, unknown>[]>),
  };
}

/** Propose le téléchargement d'un objet sous forme de fichier JSON. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Laisser le temps au navigateur de démarrer le téléchargement
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
