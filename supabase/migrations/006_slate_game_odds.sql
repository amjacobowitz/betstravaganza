ALTER TABLE public.slate_games
  ADD COLUMN IF NOT EXISTS away_odds numeric(8,2),
  ADD COLUMN IF NOT EXISTS home_odds numeric(8,2);
