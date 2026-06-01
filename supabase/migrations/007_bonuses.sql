CREATE TABLE IF NOT EXISTS public.bonuses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  betstravaganza_id uuid NOT NULL REFERENCES public.betstravaganza(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  amount           numeric(10, 2) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
