/*
  # Add category column to foods table

  1. Changes
    - Add `category` column to `foods` table to group foods by type (fruits, vegetables, proteins, etc.)
    - Make column nullable with default value for existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'foods' AND column_name = 'category'
  ) THEN
    ALTER TABLE foods ADD COLUMN category TEXT DEFAULT 'autre';
  END IF;
END $$;
