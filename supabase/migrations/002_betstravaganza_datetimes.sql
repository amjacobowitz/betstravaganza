-- Add configurable start/end datetimes to betstravaganza.
-- start_datetime is used as the slate lock time (no picks accepted after this).
-- end_datetime is informational (when the event wraps up).
alter table public.betstravaganza
  add column if not exists start_datetime timestamptz,
  add column if not exists end_datetime   timestamptz;
