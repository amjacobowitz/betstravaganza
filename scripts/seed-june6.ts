/**
 * Creates a production-ready Betstravaganza for June 6th, 2026.
 *
 * Fetches real odds from The Odds API and builds:
 *   - Required event:  Belmont Stakes (horse racing, manual field — update via Admin)
 *   - Optional events: NBA/NHL playoff matchups, French Open, MLB HR Race
 *   - Slate games:     all MLB + any additional NBA/NHL/MLS games
 *
 * ──────────────────────────────────────────────────────────────
 * Local dev (reads .env.local):
 *   npx tsx scripts/seed-june6.ts
 *
 * Production (override Supabase credentials):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SECRET_KEY=your-service-role-key \
 *   ODDS_API_KEY=your-key \
 *   npx tsx scripts/seed-june6.ts
 *
 * Players are optional at seed time — configure them via Admin › Setup before drafting.
 * If users already exist in the DB they will be picked up automatically.
 * To lock in a specific draft order: PLAYER_EMAILS="alice@...,bob@...,carol@..."
 * ──────────────────────────────────────────────────────────────
 *
 * Env vars (all optional except credentials):
 *   PLAYER_EMAILS              — comma-separated, sets draft order
 *   ROUND_COUNT                — picks per player (default 11)
 *   STAKE_AMOUNT               — dollars per pick (default 100)
 *   STARTING_BANKROLL          — dollars per player (default 1000)
 *   CONFIDENCE_MULTIPLIER      — slate confidence weight (default 3)
 *   DATE_ET                    — override date, YYYY-MM-DD ET (default 2026-06-06)
 *   DEACTIVATE_EXISTING        — set to "0" to keep other active BZs (default deactivates)
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local (only fills gaps — explicit env vars always win) ──────────
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq < 1 || line.startsWith('#')) continue
    const k = line.slice(0, eq).trim()
    if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim()
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY
const ODDS_API_KEY = process.env.ODDS_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}
if (!ODDS_API_KEY) {
  console.error('❌  Missing ODDS_API_KEY')
  process.exit(1)
}

// ── Config ────────────────────────────────────────────────────────────────────
const DATE_ET         = process.env.DATE_ET ?? '2026-06-06'
const ROUND_COUNT     = Number(process.env.ROUND_COUNT ?? 11)
const STAKE_AMOUNT    = Number(process.env.STAKE_AMOUNT ?? 100)
const START_BANKROLL  = Number(process.env.STARTING_BANKROLL ?? 1000)
const CONF_MULT       = Number(process.env.CONFIDENCE_MULTIPLIER ?? 3)
const PLAYER_EMAILS   = process.env.PLAYER_EMAILS?.split(',').map(e => e.trim()).filter(Boolean)
const DEACTIVATE      = process.env.DEACTIVATE_EXISTING !== '0'
const PREFERRED_BMS   = ['fanduel', 'draftkings', 'betmgm', 'caesars']

// June 6 ET midnight = June 6 04:00 UTC (ET = UTC−4)
const dayStartUTC = new Date(`${DATE_ET}T04:00:00Z`)
const dayEndUTC   = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000)

const admin = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg: string)  { console.log(msg) }
function tick(label: string) { console.log(`  ✓  ${label}`) }
function warn(msg: string)   { console.warn(`  ⚠  ${msg}`) }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insert<T>(label: string, q: any): Promise<T> {
  const res = await q
  if (res.error) { console.error(`  ❌  ${label}: ${res.error.message}`); process.exit(1) }
  tick(label)
  return res.data as T
}

interface OddsOutcome { name: string; price: number; point?: number }
interface OddsMarket  { key: string; outcomes: OddsOutcome[] }
interface OddsGame {
  id: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: { key: string; markets: OddsMarket[] }[]
}

async function fetchOdds(sportKey: string, markets: string[]): Promise<OddsGame[]> {
  const p = new URLSearchParams({
    apiKey:            ODDS_API_KEY!,
    regions:           'us',
    markets:           markets.join(','),
    oddsFormat:        'american',
    commenceTimeFrom:  dayStartUTC.toISOString(),
    commenceTimeTo:    dayEndUTC.toISOString(),
  })
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds?${p}`)
  if (!res.ok) {
    warn(`Odds API ${res.status} for ${sportKey}`)
    return []
  }
  const games: OddsGame[] = await res.json()
  const rem = res.headers.get('x-requests-remaining') ?? '?'
  tick(`${sportKey}: ${games.length} game(s)  [${rem} credits remaining]`)
  return games
}

function bestMarket(game: OddsGame, marketKey: string): OddsMarket | null {
  for (const bmKey of PREFERRED_BMS) {
    const m = game.bookmakers.find(b => b.key === bmKey)?.markets.find(m => m.key === marketKey)
    if (m) return m
  }
  return game.bookmakers.flatMap(b => b.markets).find(m => m.key === marketKey) ?? null
}

function homeSpread(game: OddsGame): number | null {
  const market = bestMarket(game, 'spreads')
  return market?.outcomes.find(o => o.name === game.home_team)?.point ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  log(`\n🎲  Seeding Betstravaganza — ${DATE_ET}\n`)

  // ── 1. Resolve players ───────────────────────────────────────────────────
  log('Resolving players...')
  const { data: authList } = await admin.auth.admin.listUsers()
  const allAuthUsers = authList?.users ?? []

  let playerIds: string[] = []

  if (PLAYER_EMAILS && PLAYER_EMAILS.length > 0) {
    playerIds = PLAYER_EMAILS.map(email => {
      const u = allAuthUsers.find(u => u.email === email)
      if (!u) {
        console.error(`  ❌  ${email} not found. Check PLAYER_EMAILS or run db:seed first.`)
        process.exit(1)
      }
      tick(email)
      return u.id
    })
  } else {
    // Auto-discover users with profiles, non-admin first
    const { data: profiles } = await admin
      .from('users')
      .select('id, name, is_admin')
      .order('name')
    const sorted = [...(profiles ?? [])].sort((a: any, b: any) =>
      a.is_admin === b.is_admin ? 0 : a.is_admin ? 1 : -1
    )
    if (sorted.length >= 2) {
      playerIds = sorted.map((p: any) => p.id)
      log(`  → Found ${playerIds.length} users in DB`)
      sorted.forEach((p: any) => tick(`${p.name}${p.is_admin ? ' (admin)' : ''}`))
    } else {
      warn('No players found — betstravaganza will be created without a draft order.')
      warn('Set player_count and draft_order via Admin > Setup before running the draft.')
    }
  }

  const playerCount = playerIds.length || Number(process.env.PLAYER_COUNT ?? 3)

  // ── 2. Deactivate existing active betstravaganzas ─────────────────────────
  if (DEACTIVATE) {
    const { data: existing } = await admin.from('betstravaganza').select('id, name').eq('status', 'active')
    if (existing?.length) {
      log(`\nDeactivating ${existing.length} existing active betstravaganza(s)...`)
      for (const bz of existing) {
        await insert(`deactivate: ${bz.name}`, admin.from('betstravaganza').update({ status: 'completed' }).eq('id', bz.id).select().single())
      }
    }
  }

  // ── 3. Fetch odds from The Odds API ───────────────────────────────────────
  log('\nFetching odds from The Odds API...')
  const [mlbGames, nbaGames, nhlGames, mlsGames, atpGames] = await Promise.all([
    fetchOdds('baseball_mlb',           ['h2h', 'spreads']),
    fetchOdds('basketball_nba',         ['h2h', 'spreads']),
    fetchOdds('icehockey_nhl',          ['h2h']),
    fetchOdds('soccer_usa_mls',         ['h2h']),
    fetchOdds('tennis_atp_french_open', ['h2h']),
  ])

  // ── 4. Create betstravaganza ──────────────────────────────────────────────
  log('\nCreating betstravaganza...')
  const bzStart = new Date(`${DATE_ET}T17:00:00Z`) // 1pm ET
  const bzEnd   = new Date(`${DATE_ET}T04:00:00Z`)
  bzEnd.setDate(bzEnd.getDate() + 1)

  const bz = await insert<any>(`betstravaganza: Betstravaganza — ${DATE_ET}`,
    admin.from('betstravaganza').insert({
      name:                  `Betstravaganza — ${DATE_ET}`,
      status:                'active',
      player_count:          playerCount,
      round_count:           ROUND_COUNT,
      stake_amount:          STAKE_AMOUNT,
      starting_bankroll:     START_BANKROLL,
      confidence_multiplier: CONF_MULT,
      draft_order:           playerIds,
      current_round:         1,
      current_pick_index:    0,
      start_datetime:        bzStart.toISOString(),
      end_datetime:          bzEnd.toISOString(),
    }).select().single()
  )
  const bzId = bz.id

  // ── 5. Required event: Belmont Stakes ─────────────────────────────────────
  log('\nCreating required event: Belmont Stakes...')
  const belmontTime = new Date(`${DATE_ET}T21:30:00Z`) // ~5:30pm ET post time
  const evBelmont = await insert<any>('event: Belmont Stakes (required)',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'Belmont Stakes',
      sport:             'Horse Racing',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     belmontTime.toISOString(),
      streaming_info:    'NBC / Peacock',
    }).select().single()
  )

  // Field is not available via the Odds API — add manually in Admin > Events
  // or use the placeholder horses below and update odds before the race
  const belmontField = [
    'Journalism',
    'Sandman',
    'Luxor Cafe',
    'Gosger',
    'Sovereignty',
    'Burnham Square',
    'TBD / Entrant 7',
    'TBD / Entrant 8',
  ]
  for (const label of belmontField) {
    await insert<any>(`  horse: ${label}`,
      admin.from('bet_options').insert({
        event_id: evBelmont.id, label, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('Belmont Stakes field and odds are placeholders — update via Admin > Events before the draft.')

  // ── 6. Optional events from API ───────────────────────────────────────────
  log('\nCreating optional draft events...')
  const draftEventSummary: string[] = []

  async function createMatchupDraftEvent(
    game: OddsGame,
    sport: string,
    betType: 'odds' | 'spread',
    maxDrafts: number,
  ) {
    const name = `${game.away_team} @ ${game.home_team}`
    const ev = await insert<any>(`event: ${name}`,
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name, sport, category: 'optional',
        bet_type: betType,
        start_time_et: game.commence_time,
      }).select().single()
    )

    const marketKey = betType === 'spread' ? 'spreads' : 'h2h'
    const market = bestMarket(game, marketKey)
    if (!market) { warn(`  No ${marketKey} odds found for ${name}`); return }

    for (const o of market.outcomes) {
      const label = betType === 'spread' && o.point !== undefined
        ? `${o.name} ${o.point > 0 ? '+' : ''}${o.point}`
        : `${o.name} Win`
      await insert<any>(`  opt: ${label}`,
        admin.from('bet_options').insert({
          event_id: ev.id, label, odds: o.price,
          max_drafts: maxDrafts, odds_source: 'api',
        }).select().single()
      )
    }
    draftEventSummary.push(`${name} (${sport}, ${betType})`)
  }

  // NBA: up to 2 games as spread draft events
  for (const game of nbaGames.slice(0, 2)) {
    await createMatchupDraftEvent(game, 'Basketball', 'spread', 2)
  }
  if (nbaGames.length === 0) warn('No NBA games found — Finals may not be scheduled on this date yet')

  // NHL: up to 1 game as h2h draft event
  for (const game of nhlGames.slice(0, 1)) {
    await createMatchupDraftEvent(game, 'Hockey', 'odds', 2)
  }
  if (nhlGames.length === 0) warn('No NHL games found — Finals may not be scheduled on this date yet')

  // French Open: up to 1 match
  for (const match of atpGames.slice(0, 1)) {
    await createMatchupDraftEvent(match, 'Tennis', 'odds', 2)
  }
  if (atpGames.length === 0) warn('No French Open matches found on this date')

  // MLB: one featured matchup as a draft event (the first game with the most bookmakers)
  const featuredMlb = [...mlbGames].sort(
    (a, b) => b.bookmakers.length - a.bookmakers.length
  )[0]
  if (featuredMlb) {
    await createMatchupDraftEvent(featuredMlb, 'Baseball', 'odds', 2)
  }

  // MLB HR Race — manual prop
  log('\nCreating MLB HR Race (optional)...')
  const evHR = await insert<any>('event: MLB HR Race',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'MLB HR Race',
      sport:             'Baseball',
      category:          'optional',
      bet_type:          'odds',
      start_time_et:     dayStartUTC.toISOString(),
      notes:             'Pick the player with the most home runs across all of today\'s games',
    }).select().single()
  )
  const hrRaceOptions = [
    { label: 'Aaron Judge',    odds: -130 },
    { label: 'Shohei Ohtani',  odds:  110 },
    { label: 'Juan Soto',      odds:  200 },
    { label: 'Kyle Schwarber', odds:  300 },
    { label: 'Matt Olson',     odds:  350 },
    { label: 'Pete Alonso',    odds:  400 },
  ]
  for (const o of hrRaceOptions) {
    await insert<any>(`  HR Race: ${o.label}`,
      admin.from('bet_options').insert({
        event_id: evHR.id, label: o.label, odds: o.odds,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('HR Race odds are estimates — update via Admin > Fetch Odds or manually before the draft.')

  // ── 7. Slate games ────────────────────────────────────────────────────────
  log('\nCreating slate games...')
  const slateCounts: Record<string, number> = {}

  async function addSlate(game: OddsGame, sport: string) {
    await insert<any>(`  ${game.away_team} @ ${game.home_team}`,
      admin.from('slate_games').insert({
        betstravaganza_id: bzId,
        away_team:         game.away_team,
        home_team:         game.home_team,
        sport_label:       sport,
        start_time_et:     game.commence_time,
        spread:            homeSpread(game),
      }).select().single()
    )
    slateCounts[sport] = (slateCounts[sport] ?? 0) + 1
  }

  // All MLB games
  for (const g of mlbGames) await addSlate(g, 'Baseball')

  // NBA games beyond the 2 used for draft events
  for (const g of nbaGames.slice(2)) await addSlate(g, 'Basketball')

  // NHL games beyond the 1 used for draft event
  for (const g of nhlGames.slice(1)) await addSlate(g, 'Hockey')

  // All MLS games
  for (const g of mlsGames) await addSlate(g, 'Soccer')

  // ── 8. Summary ────────────────────────────────────────────────────────────
  const totalSlate = Object.values(slateCounts).reduce((a, b) => a + b, 0)
  log('\n' + '═'.repeat(64))
  log(`✅  Betstravaganza created for ${DATE_ET}`)
  log(`\n   ID:       ${bzId}`)
  log(`   Rounds: ${ROUND_COUNT}  |  Stake: $${STAKE_AMOUNT}`)
  if (playerIds.length > 0) {
    log(`   Players: ${playerIds.length} (draft order set)`)
  } else {
    log(`   Players: ⚠  NOT SET — configure via Admin › Setup before drafting`)
  }
  log('\n   Draft events:')
  log(`     ⭐ Belmont Stakes — REQUIRED, ${belmontField.length} horses (update field + odds in Admin)`)
  draftEventSummary.forEach(s => log(`     ⚔  ${s}`))
  log(`     ⚾ MLB HR Race — optional, ${hrRaceOptions.length} options (update odds in Admin)`)
  log(`\n   Slate games: ${totalSlate} total`)
  Object.entries(slateCounts).forEach(([sport, n]) => log(`     ${n}x ${sport}`))
  log('\n   Next steps:')
  log(`     1. Admin › Events › ↓ Fetch Odds from API  — refresh all odds + spreads`)
  log(`        (Belmont Stakes won't match — update that field manually)`)
  log(`     2. Update Belmont Stakes field with real entrants and odds`)
  if (playerIds.length === 0) {
    log(`     3. Admin › Setup — add players and set draft order`)
    log(`     4. Run the draft:  /admin/${bzId}/draft`)
  } else {
    log(`     3. Run the draft:  /admin/${bzId}/draft`)
  }
  log(`     ${playerIds.length === 0 ? 5 : 4}. During the day: Admin › Results to enter scores as games finish`)
  log('═'.repeat(64) + '\n')
}

run().catch(err => { console.error('\n❌', err.message ?? err); process.exit(1) })
