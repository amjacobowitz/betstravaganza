-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ─────────────────────────────────────────────
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text not null,
  team_name   text not null,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- BETSTRAVAGANZA (single active session)
-- ─────────────────────────────────────────────
create table public.betstravaganza (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  status                text not null default 'setup'
                          check (status in ('setup','draft','active','complete')),
  player_count          int not null default 11,
  round_count           int not null default 11,
  stake_amount          numeric(10,2) not null default 100.00,
  starting_bankroll     numeric(10,2) not null default 1100.00,
  confidence_multiplier numeric(10,2) not null default 3.00,
  draft_order           uuid[] not null default '{}',
  current_round         int not null default 1,
  current_pick_index    int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────────
create table public.events (
  id             uuid primary key default uuid_generate_v4(),
  betstravaganza_id uuid not null references public.betstravaganza(id) on delete cascade,
  name           text not null,
  sport          text not null,
  category       text not null check (category in ('required','optional')),
  bet_type       text not null check (bet_type in ('odds','spread','no_odds')),
  start_time_et  timestamptz,
  streaming_info text,
  notes          text,
  sort_order     int not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- BET OPTIONS (horses, drivers, teams, players)
-- ─────────────────────────────────────────────
create table public.bet_options (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid not null references public.events(id) on delete cascade,
  label             text not null,
  odds              numeric(8,2),            -- null = no_odds event
  odds_source       text default 'manual'
                      check (odds_source in ('manual','auto','auto_confirmed')),
  max_drafts        int not null default 1,  -- 2 for Belmont races
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- DRAFT PICKS
-- ─────────────────────────────────────────────
create table public.draft_picks (
  id              uuid primary key default uuid_generate_v4(),
  betstravaganza_id uuid not null references public.betstravaganza(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  bet_option_id   uuid not null references public.bet_options(id) on delete cascade,
  round_number    int not null,
  pick_index      int not null,  -- position in overall draft order
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A user can hold a bet_option only once, except where max_drafts > 1
  -- Enforced at application layer (Belmont exception)
  unique (user_id, bet_option_id)
);

-- ─────────────────────────────────────────────
-- SLATE GAMES (generic: MLB this time)
-- ─────────────────────────────────────────────
create table public.slate_games (
  id                uuid primary key default uuid_generate_v4(),
  betstravaganza_id uuid not null references public.betstravaganza(id) on delete cascade,
  sport_label       text not null default 'MLB',
  home_team         text not null,
  away_team         text not null,
  start_time_et     timestamptz not null,
  spread            numeric(5,2),  -- positive = home favored (e.g., -1.5 stored as -1.5)
  notes             text,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SLATE PICKS (confidence rankings)
-- ─────────────────────────────────────────────
create table public.slate_picks (
  id                uuid primary key default uuid_generate_v4(),
  betstravaganza_id uuid not null references public.betstravaganza(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  slate_game_id     uuid not null references public.slate_games(id) on delete cascade,
  team_picked       text not null check (team_picked in ('home','away')),
  confidence_rank   int not null,
  submitted_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, slate_game_id),
  unique (user_id, betstravaganza_id, confidence_rank)  -- ranks must be unique per user
);

-- ─────────────────────────────────────────────
-- RESULTS (raw facts — outcome derived in UI)
-- ─────────────────────────────────────────────
create table public.results (
  id                    uuid primary key default uuid_generate_v4(),
  event_id              uuid not null unique references public.events(id) on delete cascade,
  winner_bet_option_id  uuid references public.bet_options(id) on delete set null,
  home_score            numeric(6,1),  -- nullable: only for team sports
  away_score            numeric(6,1),
  result_display        text not null default '',
  entered_by            uuid references public.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- SLATE RESULTS
-- ─────────────────────────────────────────────
create table public.slate_results (
  id              uuid primary key default uuid_generate_v4(),
  slate_game_id   uuid not null unique references public.slate_games(id) on delete cascade,
  home_score      numeric(6,1) not null,
  away_score      numeric(6,1) not null,
  result_display  text not null default '',
  entered_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- AUTO-UPDATE updated_at ON ALL TABLES
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users','betstravaganza','events','bet_options',
    'draft_picks','slate_games','slate_picks','results','slate_results'
  ] loop
    execute format(
      'create trigger trg_%s_updated_at
       before update on public.%s
       for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.betstravaganza enable row level security;
alter table public.events         enable row level security;
alter table public.bet_options    enable row level security;
alter table public.draft_picks    enable row level security;
alter table public.slate_games    enable row level security;
alter table public.slate_picks    enable row level security;
alter table public.results        enable row level security;
alter table public.slate_results  enable row level security;

-- Authenticated users can read everything
create policy "auth_read_users"          on public.users          for select using (auth.role() = 'authenticated');
create policy "auth_read_betstravaganza" on public.betstravaganza for select using (auth.role() = 'authenticated');
create policy "auth_read_events"         on public.events         for select using (auth.role() = 'authenticated');
create policy "auth_read_bet_options"    on public.bet_options    for select using (auth.role() = 'authenticated');
create policy "auth_read_draft_picks"    on public.draft_picks    for select using (auth.role() = 'authenticated');
create policy "auth_read_slate_games"    on public.slate_games    for select using (auth.role() = 'authenticated');
create policy "auth_read_slate_picks"    on public.slate_picks    for select using (auth.role() = 'authenticated');
create policy "auth_read_results"        on public.results        for select using (auth.role() = 'authenticated');
create policy "auth_read_slate_results"  on public.slate_results  for select using (auth.role() = 'authenticated');

-- Users can write/update their own picks
create policy "own_slate_picks_insert" on public.slate_picks for insert with check (auth.uid() = user_id);
create policy "own_slate_picks_update" on public.slate_picks for update using (auth.uid() = user_id);

-- Users can update their own profile (name/team_name)
create policy "own_user_update" on public.users for update using (auth.uid() = id);

-- Admins can do everything (checked via users.is_admin)
create policy "admin_all_betstravaganza" on public.betstravaganza for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_events" on public.events for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_bet_options" on public.bet_options for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_draft_picks" on public.draft_picks for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_slate_games" on public.slate_games for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_results" on public.results for all
  using ((select is_admin from public.users where id = auth.uid()));
create policy "admin_all_slate_results" on public.slate_results for all
  using ((select is_admin from public.users where id = auth.uid()));

-- Insert for new users (own row)
create policy "own_user_insert" on public.users for insert with check (auth.uid() = id);
