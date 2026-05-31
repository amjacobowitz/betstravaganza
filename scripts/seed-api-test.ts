/**
 * Seed a betstravaganza with today's real MLB games from the Odds API.
 * Used to validate the "Fetch from API" button in the Results page.
 *
 * Usage:
 *   npm run db:seed-api-test
 *
 * Env required (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ODDS_API_KEY
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
const oddsKey = process.env.ODDS_API_KEY

if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}
if (!oddsKey) {
  console.error('❌  Missing ODDS_API_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ok<T>(label: string, res: { data: T | null; error: any }): Promise<T> {
  if (res.error) {
    console.error(`  ❌  ${label}: ${res.error.message}`)
    process.exit(1)
  }
  console.log(`  ✓  ${label}`)
  return res.data as T
}

interface OddsGame {
  id: string
  commence_time: string
  completed: boolean
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
}

async function fetchTodaysGames(sportKey: string): Promise<OddsGame[]> {
  const resp = await fetch(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/scores?daysFrom=1&apiKey=${oddsKey}`,
    { headers: { 'Accept': 'application/json' } }
  )
  if (!resp.ok) {
    console.warn(`  ⚠  Odds API returned ${resp.status} for ${sportKey}`)
    return []
  }
  const games: OddsGame[] = await resp.json()

  // Filter to games whose ET date is today (May 31 2026)
  // EDT = UTC-4; today window: 2026-05-31T04:00:00Z to 2026-06-01T04:00:00Z
  const todayStart = new Date('2026-05-31T04:00:00Z').getTime()
  const todayEnd   = new Date('2026-06-01T04:00:00Z').getTime()

  return games.filter(g => {
    const t = new Date(g.commence_time).getTime()
    return t >= todayStart && t < todayEnd
  })
}

async function run() {
  console.log('\n🎲  Seeding API test betstravaganza...\n')

  // ── 1. Find existing seed users ───────────────────────────────────────────
  const adminEmail = process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
  if (!adminEmail) {
    console.error('❌  Missing NEXT_PUBLIC_INITIAL_ADMIN_EMAIL in .env.local')
    process.exit(1)
  }
  const emails = [adminEmail, 'bob@example.com', 'charlie@example.com']
  console.log('Looking up seed users...')
  const { data: list } = await admin.auth.admin.listUsers()
  const userIds: string[] = []
  for (const email of emails) {
    const u = list?.users.find(u => u.email === email)
    if (!u) {
      console.error(`  ❌  User ${email} not found. Run npm run db:seed first.`)
      process.exit(1)
    }
    userIds.push(u.id)
    console.log(`  ✓  found ${email}`)
  }

  // ── 2. Fetch today's MLB games from Odds API ───────────────────────────────
  console.log('\nFetching today\'s MLB games from the Odds API...')
  const mlbGames = await fetchTodaysGames('baseball_mlb')
  console.log(`  → ${mlbGames.length} MLB game(s) found for today`)

  if (mlbGames.length === 0) {
    console.log('\n⚠  No MLB games found for today. Trying the last 3 days instead...')
    const resp = await fetch(
      `https://api.the-odds-api.com/v4/sports/baseball_mlb/scores?daysFrom=3&apiKey=${oddsKey}`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (resp.ok) {
      const all: OddsGame[] = await resp.json()
      console.log(`  → ${all.length} total MLB game(s) in last 3 days`)
      // Take up to 5 most recent
      const recent = all.slice(-5)
      mlbGames.push(...recent)
      console.log(`  → Using ${recent.length} most recent game(s) for testing`)
    }
  }

  const gamesToUse = mlbGames.slice(0, 10) // cap at 10

  // ── 3. Create betstravaganza ───────────────────────────────────────────────
  console.log('\nCreating betstravaganza...')
  const today = new Date()
  const bzName = `API Test ${today.toISOString().slice(0, 10)}`
  const bzStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0, 0)
  const bzEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 0, 0)

  const bz = await ok('betstravaganza', await admin.from('betstravaganza').insert({
    name:                  bzName,
    status:                'active',
    player_count:          3,
    round_count:           3,
    stake_amount:          100,
    starting_bankroll:     300,
    confidence_multiplier: 3,
    draft_order:           userIds,
    current_round:         1,
    current_pick_index:    9, // all picks done
    start_datetime:        bzStart.toISOString(),
    end_datetime:          bzEnd.toISOString(),
  }).select().single())

  const bzId = (bz as any).id as string

  // ── 4. Events ──────────────────────────────────────────────────────────────
  console.log('\nCreating events...')
  const ev1 = await ok('event: MLB HR Race (required)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'MLB HR Race',
    sport:           'Baseball',
    category:        'required',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  const ev2 = await ok('event: Strikeout Props (optional)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'Strikeout Props',
    sport:           'Baseball',
    category:        'optional',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  // Bet options
  const opt1a = await ok('option: Aaron Judge', await admin.from('bet_options').insert({
    event_id: (ev1 as any).id, label: 'Aaron Judge', odds: -150, max_drafts: 1, odds_source: 'manual',
  }).select().single())
  const opt1b = await ok('option: Shohei Ohtani', await admin.from('bet_options').insert({
    event_id: (ev1 as any).id, label: 'Shohei Ohtani', odds: 120, max_drafts: 1, odds_source: 'manual',
  }).select().single())
  const opt2a = await ok('option: Over 12.5 Ks', await admin.from('bet_options').insert({
    event_id: (ev2 as any).id, label: 'Over 12.5 Ks', odds: -110, max_drafts: 1, odds_source: 'manual',
  }).select().single())
  const opt2b = await ok('option: Under 12.5 Ks', await admin.from('bet_options').insert({
    event_id: (ev2 as any).id, label: 'Under 12.5 Ks', odds: -110, max_drafts: 1, odds_source: 'manual',
  }).select().single())
  const opt2c = await ok('option: Exactly 12 Ks', await admin.from('bet_options').insert({
    event_id: (ev2 as any).id, label: 'Exactly 12 Ks', odds: 800, max_drafts: 1, odds_source: 'manual',
  }).select().single())

  // Draft picks (3 players × 3 rounds = 9)
  console.log('\nCreating draft picks...')
  const picks = [
    // Round 1 (Alice, Bob, Charlie)
    { uid: userIds[0], opt: (opt1a as any).id, round: 1, idx: 0 },
    { uid: userIds[1], opt: (opt1b as any).id, round: 1, idx: 1 },
    { uid: userIds[2], opt: (opt2a as any).id, round: 1, idx: 2 },
    // Round 2 (Charlie, Bob, Alice)
    { uid: userIds[2], opt: (opt2b as any).id, round: 2, idx: 3 },
    { uid: userIds[1], opt: (opt2c as any).id, round: 2, idx: 4 },
    { uid: userIds[0], opt: (opt2a as any).id, round: 2, idx: 5 }, // will fail if max_drafts=1 — use safe opt
    // Round 3 (Alice, Bob, Charlie)
    { uid: userIds[0], opt: (opt2b as any).id, round: 3, idx: 6 },
    { uid: userIds[1], opt: (opt1a as any).id, round: 3, idx: 7 },
    { uid: userIds[2], opt: (opt1b as any).id, round: 3, idx: 8 },
  ]
  // Assign distinct options per round to avoid max_drafts=1 conflicts
  const allOptions = [opt1a, opt1b, opt2a, opt2b, opt2c]
  const safePicks = [
    { uid: userIds[0], opt: (opt1a as any).id, round: 1, idx: 0 },
    { uid: userIds[1], opt: (opt1b as any).id, round: 1, idx: 1 },
    { uid: userIds[2], opt: (opt2a as any).id, round: 1, idx: 2 },
    { uid: userIds[2], opt: (opt2b as any).id, round: 2, idx: 3 },
    { uid: userIds[1], opt: (opt2c as any).id, round: 2, idx: 4 },
    { uid: userIds[0], opt: (opt2b as any).id, round: 2, idx: 5 },
    { uid: userIds[0], opt: (opt2c as any).id, round: 3, idx: 6 },
    { uid: userIds[1], opt: (opt2a as any).id, round: 3, idx: 7 },
    { uid: userIds[2], opt: (opt1b as any).id, round: 3, idx: 8 },
  ]
  for (const dp of safePicks) {
    await ok(`  pick r${dp.round} user ${dp.uid.slice(0,8)}`,
      await admin.from('draft_picks').insert({
        betstravaganza_id: bzId,
        user_id:           dp.uid,
        bet_option_id:     dp.opt,
        round_number:      dp.round,
        pick_index:        dp.idx,
      }).select().single()
    )
  }

  // ── 5. Slate games from Odds API ──────────────────────────────────────────
  console.log('\nCreating slate games from real API data...')
  const slateGames: any[] = []

  for (const g of gamesToUse) {
    const sg = await ok(`  game: ${g.away_team} @ ${g.home_team}`,
      await admin.from('slate_games').insert({
        betstravaganza_id: bzId,
        away_team:         g.away_team,
        home_team:         g.home_team,
        sport_label:       'Baseball',
        start_time_et:     g.commence_time,
      }).select().single()
    )
    slateGames.push({ ...(sg as any), _apiId: g.id, _completed: g.completed, _scores: g.scores })
  }

  if (slateGames.length === 0) {
    console.log('\n⚠  No slate games created (no games found). Results tab will show empty slate.')
  }

  // ── 6. Slate picks ─────────────────────────────────────────────────────────
  if (slateGames.length > 0) {
    console.log('\nCreating slate picks...')
    for (let i = 0; i < slateGames.length; i++) {
      const sg = slateGames[i]
      const rank = slateGames.length - i // descending: first game = most confident
      // Alice: always picks away; Bob: always home; Charlie: alternates
      await ok(`  alice → away game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[0],
        slate_game_id: sg.id, team_picked: 'away', confidence_rank: rank,
      }).select().single())
      await ok(`  bob → home game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[1],
        slate_game_id: sg.id, team_picked: 'home', confidence_rank: rank,
      }).select().single())
      await ok(`  charlie → ${i % 2 === 0 ? 'away' : 'home'} game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[2],
        slate_game_id: sg.id, team_picked: i % 2 === 0 ? 'away' : 'home', confidence_rank: rank,
      }).select().single())
    }
  }

  // ── 7. Summary ─────────────────────────────────────────────────────────────
  console.log('\n✅  API test seed complete!')
  console.log(`\n   Betstravaganza ID: ${bzId}`)
  console.log(`   Name: ${bzName}`)
  console.log(`   Admin URL: /admin/${bzId}/results`)
  console.log(`\n   Slate games created: ${slateGames.length}`)
  if (slateGames.length > 0) {
    for (const sg of slateGames) {
      const status = sg._completed ? '✓ complete' : '⏳ pending'
      console.log(`     ${sg.away_team} @ ${sg.home_team} — ${status}`)
    }
  }
  console.log('\n   Click "Fetch from API" on the results page once games finish.')
}

run().catch(err => { console.error('\n❌ ', err.message ?? err); process.exit(1) })
