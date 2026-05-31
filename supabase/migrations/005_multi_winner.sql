-- Support multiple winners per event (e.g. soccer goal scorers)
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS winner_bet_option_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill array from existing single-winner rows
UPDATE public.results
  SET winner_bet_option_ids = ARRAY[winner_bet_option_id]
  WHERE winner_bet_option_id IS NOT NULL;
