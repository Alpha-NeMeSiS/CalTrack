// Supabase simulé pour les tests de bout en bout : toutes les requêtes vers
// https://fake.supabase.co sont interceptées par Playwright et reçoivent des
// données de démonstration. Aucun appel réseau réel, aucune clé nécessaire.
import type { Page } from '@playwright/test';

export const SUPABASE_URL = 'https://fake.supabase.co';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
// « Aujourd'hui » à Paris, le fuseau du navigateur de test (playwright.config.ts) :
// sinon, autour de minuit, les données du jour tomberaient la veille. Midi évite
// les changements d'heure.
const parisDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const today = new Date(`${parisDate}T12:00:00`);
const TODAY = ymd(today);

const profile = {
  id: USER_ID,
  email: 'demo@caltrack.app',
  first_name: 'Alex',
  last_name: 'Martin',
  sexe: 'M',
  date_naissance: '1998-05-12',
  taille_cm: 178,
  poids_kg: 79.2,
  body_fat_pct: null,
  created_at: addDays(today, -40).toISOString(),
  updated_at: today.toISOString(),
};

const goalStart = addDays(today, -21);
const goal = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: USER_ID,
  type: 'loss',
  activity_level: 1.55,
  method: 'mifflin',
  deficit_or_surplus_pct: 20,
  protein_g_per_kg: 2,
  fat_g_per_kg_min: 0.8,
  is_active: true,
  target_weight_kg: 74,
  start_weight_kg: 82,
  duration_weeks: 12,
  start_date: ymd(goalStart),
  end_date: ymd(addDays(goalStart, 84)),
  created_at: goalStart.toISOString(),
};
const previousGoal = {
  ...goal,
  id: '33333333-3333-4333-8333-333333333333',
  type: 'maintain',
  is_active: false,
  deficit_or_surplus_pct: 0,
  target_weight_kg: null,
  start_weight_kg: 83,
  duration_weeks: null,
  start_date: ymd(addDays(today, -90)),
  end_date: null,
  created_at: addDays(today, -90).toISOString(),
};

const target = (date: string) => ({
  id: `t-${date}`,
  user_id: USER_ID,
  date,
  calories_kcal: 2150,
  protein_g: 158.4,
  fat_g: 63.4,
  carbs_g: 236.2,
  fiber_g: 25,
  goal_id: goal.id,
  created_at: `${date}T06:00:00Z`,
});

const entry = (
  id: string,
  date: string,
  label: string,
  qty: number,
  kcal: number,
  [protein, fat, carbs, fiber]: number[],
  meal: string,
  hour: string
) => ({
  id,
  user_id: USER_ID,
  date,
  label,
  qty_grammes: qty,
  kcal,
  protein_g: protein,
  fat_g: fat,
  carbs_g: carbs,
  fiber_g: fiber,
  meal_type: meal,
  created_at: `${date}T${hour}:00:00Z`,
});

const todayEntries = [
  entry('e1', TODAY, "Flocons d'avoine", 80, 297, [10.6, 5.6, 47.8, 8], 'breakfast', '07'),
  entry('e2', TODAY, 'Banane', 120, 107, [1.3, 0.4, 27.6, 3.1], 'breakfast', '07'),
  entry('e3', TODAY, 'Poulet rôti', 150, 248, [46.5, 5.4, 0, 0], 'lunch', '12'),
  entry('e4', TODAY, 'Riz blanc cuit', 200, 260, [5.4, 0.6, 56, 0.8], 'lunch', '12'),
];

// Historique sur 30 jours : consommation variable (sous, dans et au-dessus de
// l'objectif) et quelques jours sans saisie, pour afficher tous les statuts.
const history: ReturnType<typeof entry>[] = [];
for (let i = 1; i <= 29; i++) {
  if (i % 6 === 0) continue;
  const kcal = 1700 + ((i * 137) % 700);
  history.push(
    entry(`h${i}`, ymd(addDays(today, -i)), 'Repas', 500, kcal, [kcal * 0.07, kcal * 0.03, kcal * 0.11, 20], 'lunch', '12')
  );
}

const weightLogs = Array.from({ length: 15 }, (_, i) => {
  const daysAgo = 28 - i * 2;
  return {
    id: `w${daysAgo}`,
    user_id: USER_ID,
    date: ymd(addDays(today, -daysAgo)),
    weight_kg: Math.round((79.2 + daysAgo * 0.1 + (i % 2 ? 0.3 : -0.3)) * 10) / 10,
  };
});

const searchResults = {
  products: [
    {
      code: '3017620422003',
      product_name: 'Pâte à tartiner',
      brands: 'Marque démo',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, fat_100g: 30.9, carbohydrates_100g: 57.5 },
    },
  ],
};

// Recette de démonstration (spec des recettes) : chili maison, 4 parts, 1 800 g cuit
const chiliIngredients = [
  ['Haricots rouges, cuits', 400, 115, 8.7, 0.5, 15, 6.5],
  ['Bœuf haché 5 %, cru', 500, 125, 21, 5, 0, 0],
  ['Tomates concassées', 400, 25, 1.2, 0.2, 4, 1.2],
  ['Riz blanc, cuit', 600, 130, 2.7, 0.3, 28, 0.4],
] as const;
const recipes = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    user_id: USER_ID,
    name: 'Chili maison',
    servings: 4,
    cooked_weight_g: 1800,
    created_at: addDays(today, -5).toISOString(),
    updated_at: addDays(today, -5).toISOString(),
    recipe_ingredients: chiliIngredients.map(([label, qty_g, kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g], position) => ({
      id: `ing-${position}`,
      recipe_id: '44444444-4444-4444-8444-444444444444',
      position,
      label,
      qty_g,
      kcal_per_100g,
      protein_g,
      fat_g,
      carbs_g,
      fiber_g,
    })),
  },
];

// Eau : 0,5 + 0,75 L aujourd'hui, et un historique sur 7 jours
const water = (daysAgo: number, amount_ml: number, hour: string) => {
  const date = ymd(addDays(today, -daysAgo));
  return { id: `eau-${daysAgo}-${hour}`, user_id: USER_ID, date, amount_ml, created_at: `${date}T${hour}:00:00Z` };
};
const waterLogs = [
  water(0, 500, '08'),
  water(0, 750, '12'),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((d) => [water(d, 1000 + (d % 3) * 400, '09'), water(d, 900, '15')]),
];

/** Filtre PostgREST sur les dates (eq., gte., lte.) */
function inDateRange(date: string, filters: string[]) {
  return filters.every((filter) => {
    const [op, value] = [filter.slice(0, filter.indexOf('.')), filter.slice(filter.indexOf('.') + 1)];
    if (op === 'eq') return date === value;
    if (op === 'gte') return date >= value;
    if (op === 'lte') return date <= value;
    return true;
  });
}

const jwt = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, exp: 4102444800, role: 'authenticated' })}.sig`;
};

const session = {
  access_token: jwt(),
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  user: { id: USER_ID, email: profile.email, aud: 'authenticated', role: 'authenticated' },
};

function rowsFor(table: string, params: URLSearchParams): unknown[] {
  const dateFilter = params.get('date');
  const exactDate = dateFilter?.startsWith('eq.') ? dateFilter.slice(3) : null;
  switch (table) {
    case 'profiles':
      return [profile];
    case 'goals':
      return params.get('is_active') === 'eq.true' ? [goal] : [goal, previousGoal];
    case 'daily_targets':
      return exactDate ? [target(exactDate)] : Array.from({ length: 31 }, (_, i) => target(ymd(addDays(today, -i))));
    case 'entries':
      return exactDate ? (exactDate === TODAY ? todayEntries : []) : [...todayEntries, ...history];
    case 'weight_logs':
      return weightLogs;
    case 'recipes':
      return recipes;
    case 'water_logs':
      return waterLogs.filter((log) => inDateRange(log.date, params.getAll('date')));
    default:
      return [];
  }
}

/** Intercepte Supabase (auth, base, stockage) et la recherche d'aliments */
export async function mockSupabase(page: Page) {
  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const reply = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
      if (url.pathname.endsWith('/user')) return reply(session.user);
      return reply({ error: 'non simulé' }, 400);
    }
    if (url.pathname.startsWith('/storage/v1/')) return reply([]);

    const table = url.pathname.replace('/rest/v1/', '');
    if (request.method() !== 'GET') {
      let body: unknown = {};
      try {
        body = JSON.parse(request.postData() ?? '{}');
      } catch {
        // corps vide
      }
      const row = Array.isArray(body) ? body[0] : body;
      return reply(wantsObject ? { id: 'new', ...row } : [{ id: 'new', ...row }], 201);
    }
    const rows = rowsFor(table, url.searchParams);
    return reply(wantsObject ? (rows[0] ?? null) : rows);
  });

  await page.route('**/api/off/search**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchResults) })
  );
}

/** Ouvre une session simulée (à appeler avant page.goto) */
export async function signIn(page: Page) {
  await page.addInitScript((value) => localStorage.setItem('sb-fake-auth-token', value), JSON.stringify(session));
}
