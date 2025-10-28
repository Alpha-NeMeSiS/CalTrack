/*
  # Add Goal Duration and Target Weight

  ## Changes
  
  1. **goals table modifications**
    - Add `target_weight_kg` (numeric, nullable) - The target weight the user wants to achieve
    - Add `duration_weeks` (integer, nullable) - The duration in weeks to achieve the goal
    - Add `start_date` (date, nullable) - The date when the goal starts
    - Add `end_date` (date, nullable) - The calculated end date based on start_date + duration
    
  2. **New calculated fields**
    - Weekly weight change rate calculated from (target_weight - current_weight) / duration_weeks
    - This allows for progressive calorie adjustments as the user approaches their goal
  
  ## Notes
  
  - Fields are nullable to maintain backward compatibility with existing goals
  - For maintenance goals, target_weight and duration can be null
  - For loss/gain goals, these fields should ideally be populated for better tracking
*/

-- Add new columns to goals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'target_weight_kg'
  ) THEN
    ALTER TABLE goals ADD COLUMN target_weight_kg numeric CHECK (target_weight_kg > 0 AND target_weight_kg <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'duration_weeks'
  ) THEN
    ALTER TABLE goals ADD COLUMN duration_weeks integer CHECK (duration_weeks > 0 AND duration_weeks <= 260);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE goals ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'goals' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE goals ADD COLUMN end_date date;
  END IF;
END $$;

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_goals_dates ON goals(start_date, end_date) WHERE start_date IS NOT NULL;
