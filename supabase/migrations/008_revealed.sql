ALTER TABLE public.betstravaganza
  ADD COLUMN IF NOT EXISTS revealed boolean NOT NULL DEFAULT false;
