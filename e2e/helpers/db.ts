import { createClient } from '@supabase/supabase-js'

// Admin Supabase client — bypasses RLS, used only in test setup/teardown
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars for E2E tests')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface TestUser {
  id: string
  email: string
  password: string
  name: string
  teamName: string
}

export async function createTestUser(opts: {
  email: string
  name: string
  teamName: string
  isAdmin?: boolean
}): Promise<TestUser> {
  const sb = adminClient()
  const password = 'Test-Password-123!'

  const { data, error } = await sb.auth.admin.createUser({
    email: opts.email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`createTestUser auth: ${error.message}`)

  const { error: profileError } = await sb.from('users').insert({
    id: data.user.id,
    email: opts.email,
    name: opts.name,
    team_name: opts.teamName,
    is_admin: opts.isAdmin ?? false,
  })
  if (profileError) throw new Error(`createTestUser profile: ${profileError.message}`)

  return { id: data.user.id, email: opts.email, password, name: opts.name, teamName: opts.teamName }
}

export async function deleteTestUser(userId: string) {
  const sb = adminClient()
  await sb.from('users').delete().eq('id', userId)
  await sb.auth.admin.deleteUser(userId)
}

export async function createTestBetstravaganza(opts: {
  name: string
  playerCount?: number
  roundCount?: number
}) {
  const sb = adminClient()
  const { data, error } = await sb.from('betstravaganza').insert({
    name: opts.name,
    player_count: opts.playerCount ?? 3,
    round_count: opts.roundCount ?? 3,
    stake_amount: 100,
    starting_bankroll: 300,
    confidence_multiplier: 3,
    status: 'setup',
  }).select().single()
  if (error) throw new Error(`createTestBetstravaganza: ${error.message}`)
  return data
}

export async function deleteTestBetstravaganza(bzId: string) {
  const sb = adminClient()
  // Cascade deletes events, picks, slate_games, etc.
  await sb.from('betstravaganza').delete().eq('id', bzId)
}

export async function createTestEvent(bzId: string, opts: {
  name: string
  sport: string
  category: 'required' | 'optional'
  betType?: 'odds' | 'spread' | 'no_odds'
  sortOrder?: number
}) {
  const sb = adminClient()
  const { data, error } = await sb.from('events').insert({
    betstravaganza_id: bzId,
    name: opts.name,
    sport: opts.sport,
    category: opts.category,
    bet_type: opts.betType ?? 'odds',
    sort_order: opts.sortOrder ?? 0,
  }).select().single()
  if (error) throw new Error(`createTestEvent: ${error.message}`)
  return data
}

export async function createTestBetOption(eventId: string, opts: {
  label: string
  odds?: number | null
  maxDrafts?: number
}) {
  const sb = adminClient()
  const { data, error } = await sb.from('bet_options').insert({
    event_id: eventId,
    label: opts.label,
    odds: opts.odds ?? null,
    max_drafts: opts.maxDrafts ?? 1,
  }).select().single()
  if (error) throw new Error(`createTestBetOption: ${error.message}`)
  return data
}

export async function createTestSlateGame(bzId: string, opts: {
  awayTeam: string
  homeTeam: string
  startTimeEt?: string
  sortOrder?: number
}) {
  const sb = adminClient()
  const { data, error } = await sb.from('slate_games').insert({
    betstravaganza_id: bzId,
    sport_label: 'MLB',
    away_team: opts.awayTeam,
    home_team: opts.homeTeam,
    start_time_et: opts.startTimeEt ?? '2026-06-06T13:10:00Z',
    sort_order: opts.sortOrder ?? 0,
  }).select().single()
  if (error) throw new Error(`createTestSlateGame: ${error.message}`)
  return data
}

export async function setDraftOrder(bzId: string, userIds: string[]) {
  const sb = adminClient()
  const { error } = await sb.from('betstravaganza')
    .update({ draft_order: userIds, status: 'draft' })
    .eq('id', bzId)
  if (error) throw new Error(`setDraftOrder: ${error.message}`)
}

export async function recordDraftPick(opts: {
  bzId: string
  userId: string
  betOptionId: string
  pickIndex: number
}) {
  const sb = adminClient()
  const { error } = await sb.from('draft_picks').insert({
    betstravaganza_id: opts.bzId,
    user_id: opts.userId,
    bet_option_id: opts.betOptionId,
    round_number: 1,
    pick_index: opts.pickIndex,
  })
  if (error) throw new Error(`recordDraftPick: ${error.message}`)

  await sb.from('betstravaganza')
    .update({ current_pick_index: opts.pickIndex + 1 })
    .eq('id', opts.bzId)
}

export async function upsertResult(opts: {
  eventId: string
  winnerBetOptionId: string | null
  resultDisplay: string
}) {
  const sb = adminClient()
  const { error } = await sb.from('results').upsert({
    event_id: opts.eventId,
    winner_bet_option_id: opts.winnerBetOptionId,
    result_display: opts.resultDisplay,
  }, { onConflict: 'event_id' })
  if (error) throw new Error(`upsertResult: ${error.message}`)
}

/** Generate a unique email safe for parallel test runs */
export function testEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}@test.invalid`
}
