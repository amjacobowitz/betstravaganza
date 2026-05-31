/**
 * Seed a betstravaganza with today's real MLB games from the Odds API.
 * Used to validate the "Fetch from API" button in the Results page.
 *
 * Draft starts fresh (current_pick_index=0) with enough events and options
 * to complete all 6 rounds manually.
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

  // Filter to games starting today (ET = UTC-4)
  const now = new Date()
  const todayStartET = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0
  ))
  const todayEndET = new Date(todayStartET.getTime() + 24 * 60 * 60 * 1000)

  return games.filter(g => {
    const t = new Date(g.commence_time).getTime()
    return t >= todayStartET.getTime() && t < todayEndET.getTime()
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
      const recent = all.slice(-5)
      mlbGames.push(...recent)
      console.log(`  → Using ${recent.length} most recent game(s) for testing`)
    }
  }

  const gamesToUse = mlbGames.slice(0, 12)

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
    round_count:           6,   // 2 required + 4 optional picks per player
    stake_amount:          100,
    starting_bankroll:     600,
    confidence_multiplier: 3,
    draft_order:           userIds,
    current_round:         1,
    current_pick_index:    0,   // draft starts fresh — complete it manually
    start_datetime:        bzStart.toISOString(),
    end_datetime:          bzEnd.toISOString(),
  }).select().single())

  const bzId = (bz as any).id as string

  // ── 4. Events ──────────────────────────────────────────────────────────────
  console.log('\nCreating events...')

  const ev_hrRace = await ok('event: MLB HR Race (required)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'MLB HR Race',
    sport:           'Baseball',
    category:        'required',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  const ev_ks = await ok('event: Strikeout Props (optional)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'Strikeout Props',
    sport:           'Baseball',
    category:        'optional',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  const ev_yrb = await ok('event: Yankees @ Red Sox (optional)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'Yankees @ Red Sox',
    sport:           'Baseball',
    category:        'optional',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  const ev_dodgers = await ok('event: Dodgers @ Giants (optional)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'Dodgers @ Giants',
    sport:           'Baseball',
    category:        'optional',
    bet_type:        'odds',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  const ev_nba = await ok('event: NBA Playoff Game (optional)', await admin.from('events').insert({
    betstravaganza_id: bzId,
    name:            'NBA Playoff Game',
    sport:           'Basketball',
    category:        'optional',
    bet_type:        'spread',
    start_time_et:   bzStart.toISOString(),
  }).select().single())

  // ── 5. Bet options ─────────────────────────────────────────────────────────
  // Required: MLB HR Race — 6 players, max_drafts=1 each (6 total slots)
  // Optional: 4 head-to-head events, max_drafts=2 each (4 × 2 × 2 = 16 slots)
  // Total available: 22 slots for 18 picks (6 rounds × 3 players)

  console.log('\nCreating bet options...')

  const hrRaceOptions = [
    { label: 'Aaron Judge',     odds: -150 },
    { label: 'Shohei Ohtani',   odds:  120 },
    { label: 'Kyle Schwarber',  odds:  300 },
    { label: 'Juan Soto',       odds: -105 },
    { label: 'Matt Olson',      odds:  250 },
    { label: 'Pete Alonso',     odds:  400 },
  ]
  for (const o of hrRaceOptions) {
    await ok(`  option: ${o.label}`, await admin.from('bet_options').insert({
      event_id: (ev_hrRace as any).id, label: o.label, odds: o.odds,
      max_drafts: 1, odds_source: 'manual',
    }).select().single())
  }

  const optionalEvents = [
    { ev: ev_ks,      options: [{ label: 'Over 13.5 Ks',   odds: -115 }, { label: 'Under 13.5 Ks',  odds: -105 }] },
    { ev: ev_yrb,     options: [{ label: 'Yankees Win',     odds: -130 }, { label: 'Red Sox Win',    odds:  110 }] },
    { ev: ev_dodgers, options: [{ label: 'Dodgers Win',     odds: -150 }, { label: 'Giants Win',     odds:  130 }] },
    { ev: ev_nba,     options: [{ label: 'OKC Thunder -6.5', odds: -110 }, { label: 'Indiana Pacers +6.5', odds: -110 }] },
  ]
  for (const { ev, options } of optionalEvents) {
    for (const o of options) {
      await ok(`  option: ${o.label}`, await admin.from('bet_options').insert({
        event_id: (ev as any).id, label: o.label, odds: o.odds,
        max_drafts: 2, odds_source: 'manual',
      }).select().single())
    }
  }

  // ── 6. Slate games from Odds API ──────────────────────────────────────────
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
    slateGames.push({ ...(sg as any), _completed: g.completed, _scores: g.scores })
  }

  if (slateGames.length === 0) {
    console.log('\n⚠  No slate games created. Results tab will show empty slate.')
  }

  // ── 7. Slate picks ─────────────────────────────────────────────────────────
  if (slateGames.length > 0) {
    console.log('\nCreating slate picks...')
    for (let i = 0; i < slateGames.length; i++) {
      const sg = slateGames[i]
      const rank = slateGames.length - i
      // Player 0: always away; Player 1: always home; Player 2: alternates
      await ok(`  p0 → away game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[0],
        slate_game_id: sg.id, team_picked: 'away', confidence_rank: rank,
      }).select().single())
      await ok(`  p1 → home game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[1],
        slate_game_id: sg.id, team_picked: 'home', confidence_rank: rank,
      }).select().single())
      await ok(`  p2 → ${i % 2 === 0 ? 'away' : 'home'} game ${i}`, await admin.from('slate_picks').insert({
        betstravaganza_id: bzId, user_id: userIds[2],
        slate_game_id: sg.id, team_picked: i % 2 === 0 ? 'away' : 'home', confidence_rank: rank,
      }).select().single())
    }
  }

  // ── 8. Summary ─────────────────────────────────────────────────────────────
  console.log('\n✅  API test seed complete!')
  console.log(`\n   Betstravaganza ID: ${bzId}`)
  console.log(`   Name: ${bzName}`)
  console.log(`   Admin draft URL: /admin/${bzId}/draft`)
  console.log(`   Admin results URL: /admin/${bzId}/results`)
  console.log('\n   Draft: 6 rounds, 3 players — pick_index=0, ready to draft')
  console.log('   Events:')
  console.log('     MLB HR Race (required)    — 6 options, max_drafts=1 each')
  console.log('     Strikeout Props (optional) — Over/Under, max_drafts=2')
  console.log('     Yankees @ Red Sox (optional) — ML, max_drafts=2')
  console.log('     Dodgers @ Giants (optional)  — ML, max_drafts=2')
  console.log('     NBA Playoff Game (optional)  — Spread, max_drafts=2')
  console.log(`\n   Slate games: ${slateGames.length}`)
  if (slateGames.length > 0) {
    for (const sg of slateGames) {
      const status = sg._completed ? '✓ complete' : '⏳ pending'
      console.log(`     ${sg.away_team} @ ${sg.home_team} — ${status}`)
    }
  }
  console.log('\n   Click "Fetch from API" on the results page once games finish.')
}

run().catch(err => { console.error('\n❌ ', err.message ?? err); process.exit(1) })
