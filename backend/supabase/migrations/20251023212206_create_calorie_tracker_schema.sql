/*
  # Calorie Tracker Application Schema

  ## Tables Created
  
  ### 1. profiles
    - `id` (uuid, FK to auth.users)
    - `email` (text)
    - `sexe` (text: 'M' or 'F')
    - `date_naissance` (date)
    - `taille_cm` (numeric)
    - `poids_kg` (numeric)
    - `body_fat_pct` (numeric, optional)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  
  ### 2. goals
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to profiles)
    - `type` (text: 'loss', 'maintain', 'gain')
    - `activity_level` (numeric: PAL 1.2-1.9)
    - `method` (text: 'mifflin' or 'katch')
    - `deficit_or_surplus_pct` (numeric: percentage)
    - `protein_g_per_kg` (numeric, default 2.0)
    - `fat_g_per_kg_min` (numeric, default 0.8)
    - `is_active` (boolean)
    - `created_at` (timestamptz)
  
  ### 3. daily_targets
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to profiles)
    - `date` (date)
    - `calories_kcal` (numeric)
    - `protein_g` (numeric)
    - `fat_g` (numeric)
    - `carbs_g` (numeric)
    - `fiber_g` (numeric, optional)
    - `goal_id` (uuid, FK to goals)
    - `created_at` (timestamptz)
  
  ### 4. foods
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to profiles, nullable for global foods)
    - `name` (text)
    - `kcal_per_100g` (numeric)
    - `protein_g` (numeric)
    - `fat_g` (numeric)
    - `carbs_g` (numeric)
    - `fiber_g` (numeric, default 0)
    - `is_public` (boolean)
    - `created_at` (timestamptz)
  
  ### 5. entries
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to profiles)
    - `date` (date)
    - `food_id` (uuid, FK to foods, nullable)
    - `label` (text, nullable for custom entries)
    - `qty_grammes` (numeric)
    - `kcal` (numeric)
    - `protein_g` (numeric)
    - `fat_g` (numeric)
    - `carbs_g` (numeric)
    - `fiber_g` (numeric, default 0)
    - `meal_type` (text, nullable: 'breakfast', 'lunch', 'dinner', 'snack')
    - `created_at` (timestamptz)

  ## Security
    - RLS enabled on all tables
    - Users can only access their own data
    - Public foods are readable by all authenticated users
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  sexe text NOT NULL CHECK (sexe IN ('M', 'F')),
  date_naissance date NOT NULL,
  taille_cm numeric NOT NULL CHECK (taille_cm > 0 AND taille_cm <= 300),
  poids_kg numeric NOT NULL CHECK (poids_kg > 0 AND poids_kg <= 500),
  body_fat_pct numeric CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('loss', 'maintain', 'gain')),
  activity_level numeric NOT NULL CHECK (activity_level >= 1.2 AND activity_level <= 1.9),
  method text NOT NULL DEFAULT 'mifflin' CHECK (method IN ('mifflin', 'katch')),
  deficit_or_surplus_pct numeric NOT NULL DEFAULT 0 CHECK (deficit_or_surplus_pct >= -50 AND deficit_or_surplus_pct <= 50),
  protein_g_per_kg numeric NOT NULL DEFAULT 2.0 CHECK (protein_g_per_kg >= 0.8 AND protein_g_per_kg <= 5.0),
  fat_g_per_kg_min numeric NOT NULL DEFAULT 0.8 CHECK (fat_g_per_kg_min >= 0.3 AND fat_g_per_kg_min <= 3.0),
  -- New fields added to support goal planning
  target_weight_kg numeric CHECK (target_weight_kg > 0 AND target_weight_kg <= 500),
  duration_weeks integer CHECK (duration_weeks > 0 AND duration_weeks <= 260),
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create index for active goals
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON goals(user_id, is_active) WHERE is_active = true;

-- Index to support queries by goal date ranges
CREATE INDEX IF NOT EXISTS idx_goals_dates ON goals(start_date, end_date) WHERE start_date IS NOT NULL;

-- Create daily_targets table
CREATE TABLE IF NOT EXISTS daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  calories_kcal numeric NOT NULL CHECK (calories_kcal >= 0),
  protein_g numeric NOT NULL CHECK (protein_g >= 0),
  fat_g numeric NOT NULL CHECK (fat_g >= 0),
  carbs_g numeric NOT NULL CHECK (carbs_g >= 0),
  fiber_g numeric DEFAULT 0 CHECK (fiber_g >= 0),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_date ON daily_targets(user_id, date);

-- Create foods table
CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  kcal_per_100g numeric NOT NULL CHECK (kcal_per_100g >= 0),
  protein_g numeric NOT NULL CHECK (protein_g >= 0),
  fat_g numeric NOT NULL CHECK (fat_g >= 0),
  carbs_g numeric NOT NULL CHECK (carbs_g >= 0),
  fiber_g numeric DEFAULT 0 CHECK (fiber_g >= 0),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for food search
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_user_public ON foods(user_id, is_public);

-- Create entries table
CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  food_id uuid REFERENCES foods(id) ON DELETE SET NULL,
  label text,
  qty_grammes numeric NOT NULL CHECK (qty_grammes > 0),
  kcal numeric NOT NULL CHECK (kcal >= 0),
  protein_g numeric NOT NULL CHECK (protein_g >= 0),
  fat_g numeric NOT NULL CHECK (fat_g >= 0),
  carbs_g numeric NOT NULL CHECK (carbs_g >= 0),
  fiber_g numeric DEFAULT 0 CHECK (fiber_g >= 0),
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz DEFAULT now()
);

-- Create index for entry queries
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, date);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Goals policies
CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Daily targets policies
CREATE POLICY "Users can view own targets"
  ON daily_targets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own targets"
  ON daily_targets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own targets"
  ON daily_targets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own targets"
  ON daily_targets FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Foods policies
CREATE POLICY "Users can view public foods and own foods"
  ON foods FOR SELECT
  TO authenticated
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own foods"
  ON foods FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own foods"
  ON foods FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own foods"
  ON foods FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Entries policies
CREATE POLICY "Users can view own entries"
  ON entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own entries"
  ON entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own entries"
  ON entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own entries"
  ON entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Insert some default French foods
INSERT INTO foods (name, kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g, is_public) VALUES
  ('Poulet rôti', 165, 31, 3.6, 0, 0, true),
  ('Riz blanc cuit', 130, 2.7, 0.3, 28, 0.4, true),
  ('Brocoli cuit', 35, 2.4, 0.4, 7, 3.3, true),
  ('Banane', 89, 1.1, 0.3, 23, 2.6, true),
  ('Œuf entier', 155, 13, 11, 1.1, 0, true),
  ('Pain complet', 247, 13, 3.3, 41, 7, true),
  ('Saumon cuit', 206, 22, 13, 0, 0, true),
  ('Pâtes cuites', 131, 5, 1.1, 25, 1.8, true),
  ('Yaourt nature 0%', 56, 10, 0.2, 4, 0, true),
  ('Amandes', 579, 21, 50, 22, 12, true),
  ('Pomme', 52, 0.3, 0.2, 14, 2.4, true),
  ('Avocat', 160, 2, 15, 9, 7, true)
ON CONFLICT DO NOTHING;
