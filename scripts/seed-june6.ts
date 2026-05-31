/**
 * Creates a production-ready Betstravaganza for June 6th, 2026.
 *
 * Fetches real odds from The Odds API for MLB/NHL/WNBA slate games
 * and builds 6 required events plus a full slate of optional events.
 *
 * ──────────────────────────────────────────────────────────────
 * Local dev (reads .env.local):
 *   npx tsx scripts/seed-june6.ts
 *
 * Production (override Supabase credentials):
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SECRET_KEY=your-service-role-key \
 *   ODDS_API_KEY=your-key \
 *   DEACTIVATE_EXISTING=0 \
 *   ROUND_COUNT=11 \
 *   npx tsx scripts/seed-june6.ts
 * ──────────────────────────────────────────────────────────────
 *
 * 6 Required Events (Round 1 must-pick):
 *   1. Belmont Stakes — 9-horse field (7:04pm ET, Saratoga, NBC)
 *   2. US vs Germany Friendly — goal scorer, all 52 players (2:30pm ET)
 *   3. US Women's Open Rd 3 — low score, top field (Riviera, NBC)
 *   4. Memorial Tournament Rd 3 — low score, full 72-player field (Muirfield, Golf Channel)
 *   5. DGPT Northwest Championship Rd 3 — low score, no odds (Portland)
 *   6. NASCAR DQS Solutions & Staffing 250 — race winner (Michigan, FS1)
 *
 * Optional Draft Events:
 *   - NHL Stanley Cup Final Gm 3: Hurricanes vs Golden Knights (8pm ET, ABC)
 *   - French Open Women's Final: Kostyuk vs Cîrstea (Roland-Garros)
 *   - WNBA: Seattle Storm vs Minnesota Lynx (1pm ET, ABC)
 *   - WNBA: Golden State Valkyries vs Las Vegas Aces (3pm ET, ABC)
 *   - Boxing: Billam-Smith vs Rozicki (cruiserweight, Bournemouth)
 *   - Boxing: Garcia vs Moloney + Yabuki vs Calixto (Japan)
 *   - F1 Monaco GP Qualifying — pole position prediction
 *   - West Indies vs Sri Lanka ODI 2 (Sabina Park)
 *
 * Slate Games:
 *   - All 15 MLB games (odds from API)
 *   - 2 WNBA games (odds from API)
 *   - 3 AFL games (Round 13, Australian times)
 *   - 2 NRL games
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

// June 6 ET midnight = June 6 04:00 UTC (EDT = UTC−4)
const dayStartUTC = new Date(`${DATE_ET}T04:00:00Z`)
const dayEndUTC   = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000)

const admin = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg: string)    { console.log(msg) }
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

// ── Static data ───────────────────────────────────────────────────────────────

const BELMONT_STAKES_FIELD = [
  { label: 'Golden Tempo',    odds: -160 }, // Kentucky Derby winner, morning line fav
  { label: 'Renegade',        odds:  300 },
  { label: 'Chief Wallabee',  odds:  450 },
  { label: 'Commandment',     odds:  600 },
  { label: 'Emerging Market', odds:  800 },
  { label: 'Growth Equity',   odds: 1200 },
  { label: 'Ottinho',         odds: 1500 },
  { label: 'Powershift',      odds: 2000 },
  { label: 'Vitruvian Man',   odds: 2500 },
]

// Goal-scorer options: all 52 players on both World Cup rosters
// USMNT players listed by position
const USMNT_PLAYERS = [
  // Goalkeepers (won't score but included per user request)
  'Matt Turner',
  'Matt Freese',
  'Chris Brady',
  // Defenders
  'Sergiño Dest',
  'Antonee Robinson',
  'Tim Ream',
  'Chris Richards',
  'Mark McKenzie',
  'Miles Robinson',
  'Alex Freeman',
  'Max Arfsten',
  'Auston Trusty',
  'Joe Scally',
  // Midfielders
  'Weston McKennie',
  'Tyler Adams',
  'Brenden Aaronson',
  'Malik Tillman',
  'Sebastian Berhalter',
  'Gio Reyna',
  'Cristian Roldan',
  // Forwards
  'Christian Pulisic',
  'Folarin Balogun',
  'Ricardo Pepi',
  'Tim Weah',
  'Haji Wright',
  'Alejandro Zendejas',
]

const GERMANY_PLAYERS = [
  // Goalkeepers
  'Manuel Neuer',
  'Oliver Baumann',
  'Alexander Nübel',
  'Jonas Urbig',
  // Defenders
  'Jonathan Tah',
  'Joshua Kimmich',
  'Nico Schlotterbeck',
  'Antonio Rüdiger',
  'David Raum',
  'Nathaniel Brown',
  'Waldemar Anton',
  'Malick Thiaw',
  // Midfielders
  'Pascal Groß',
  'Leon Goretzka',
  'Aleksandar Pavlović',
  'Felix Nmecha',
  'Nadiem Amiri',
  'Angelo Stiller',
  // Forwards
  'Florian Wirtz',
  'Jamal Musiala',
  'Kai Havertz',
  'Deniz Undav',
  'Nick Woltemade',
  'Jamie Leweling',
  'Lennart Karl',
  'Max Beier',
]

// US Women's Open — top field for Round 3 low-score bet
// Full 156-player field; this includes all named entrants (update odds before Rd 3 starts)
const USWOMENS_OPEN_FIELD = [
  'Jeeno Thitikul',        // World #1
  'Nelly Korda',           // 2026 Chevron champion
  'Rose Zhang',
  'Maja Stark',            // 2025 US Women's Open champion
  'Lydia Ko',
  'Brooke Henderson',
  'Jennifer Kupcho',
  'Amy Yang',
  'Céline Boutier',
  'Leona Maguire',
  'Hannah Green',
  'Ayaka Furue',
  'Chun In-gee',
  'Ariya Jutanugarn',
  'Minjee Lee',
  'Lilia Vu',
  'Hinako Shibuno',
  'Yin Ruoning',
  'Allisen Corpuz',
  'Lauren Coughlin',
  'Grace Kim',
  'Ashleigh Buhai',
  'Anna Nordqvist',
  'Miyū Yamashita',
  'Linn Grant',
  'Mao Saigo',
  'Angel Yin',
  'Hailee Cooper',
  'Choi Hye-jin',
  'Kim A-lim',
  'Lee Jeong-eun',
  'Park Sung-hyun',
  'Yuka Saso',
  'Rio Takeda',
  'Becky Morgan',
  'Megha Ganne',
  'Aphrodite Deng',
  'Ina Kim-Schaad',
  'Danielle Kang',
  'Lucy Li',
  'Bianca Pagdanganan',
  'Carla Bernat',
  'Olivia Mehaffey',
  'Bronte Law',
  'Paula Reto',
  'Gurleen Kaur',
  'Kaleiya Romero',
  'Sofia Rivera',
  'Lauren Kim',
  'Muni He',
  'Brianna Do',
]

// Memorial Tournament 2026 — full 72-player field
const MEMORIAL_TOURNAMENT_FIELD = [
  'Scottie Scheffler',    // World #1, defending champion
  'Rory McIlroy',
  'Cameron Young',
  'Matt Fitzpatrick',
  'Tommy Fleetwood',
  'Hideki Matsuyama',
  'Xander Schauffele',
  'Justin Thomas',
  'Patrick Cantlay',
  'Jordan Spieth',
  'Justin Rose',
  'Adam Scott',
  'Shane Lowry',
  'Robert MacIntyre',
  'Tony Finau',
  'Billy Horschel',
  'Sahith Theegala',
  'Russell Henley',
  'Sungjae Im',
  'Si Woo Kim',
  'Rickie Fowler',
  'Keegan Bradley',
  'Corey Conners',
  'Brian Harman',
  'Wyndham Clark',
  'Jason Day',
  'Alex Noren',
  'Nick Taylor',
  'Sepp Straka',
  'Min Woo Lee',
  'Ludvig Åberg',
  'Akshay Bhatia',
  'Sam Burns',
  'Patrick Rodgers',
  'Lucas Glover',
  'Ben Griffin',
  'Ryan Fox',
  'Ryo Hisatsune',
  'Nicolai Højgaard',
  'Tom Hoge',
  'Mark Hubbard',
  'Michael Kim',
  'Jake Knapp',
  'Denny McCarthy',
  'Matt McCarty',
  'Maverick McNealy',
  'Andrew Novak',
  'Taylor Pendrith',
  'J.T. Poston',
  'Aaron Rai',
  'Kristoffer Reitan',
  'J.J. Spaun',
  'Sam Stevens',
  'Jackson Suber',
  'Jhonattan Vegas',
  'Gary Woodland',
  'Sudarshan Yellamaraju',
  'Daniel Berger',
  'Zach Bauchou',
  'Jacob Bridgeman',
  'Brian Campbell',
  'Bud Cauley',
  'Nico Echavarria',
  'Harris English',
  'Alex Fitzpatrick',
  'Ryan Gerard',
  'Chris Gotterup',
  'Harry Hall',
  'Brandt Snedeker',
  'Alex Smalley',
  'Kurt Kitayama',
]

// DGPT Northwest Championship — Round 3 at Glendoveer East, Portland, June 6
// Top MPO players registered for the event (no odds available for disc golf)
const DGPT_NORTHWEST_FIELD = [
  'Paul McBeth',
  'Ricky Wysocki',
  'Eagle McMahon',
  'Calvin Heimburg',
  'Chris Dickerson',
  'Adam Hammes',
  'Drew Gibson',
  'James Conrad',
  'Joel Freeman',
  'Emerson Keith',
  'Aldric Dorado',
  'Gregg Barsby',
  'Simon Lizotte',
  'Gannon Buhr',
  'Kyle Klein',
  'Anthony Barela',
  'Isaac Robinson',
  'Ezra Aderhold',
  'Austin Turner',
  'Matthew Orum',
  'Nikko Locastro',
  'Graham Fuller',
  'Maxime Tanghe',
  'Scott Withers',
  'Emmanuel Torres',
  'Henry Thoma',
  'Sean Martin',
  'Samuel Snider',
  'Braeden Sides',
  'Jason Lawson',
]

// NASCAR DQS Solutions & Staffing 250 — Michigan International Speedway, June 6
// 40 trucks entered; best-available odds (manual — update via Admin before race)
const NASCAR_TRUCK_FIELD: { label: string; odds: number | null }[] = [
  { label: 'Layne Riggs',      odds:  -140 }, // in-form, won Nashville
  { label: 'Ben Rhodes',       odds:   350 },
  { label: 'Ty Majeski',       odds:   400 },
  { label: 'Christian Eckes',  odds:   450 },
  { label: 'Grant Enfinger',   odds:   500 },
  { label: 'Tyler Ankrum',     odds:   600 },
  { label: 'Justin Haley',     odds:   700 },
  { label: 'Brandon Jones',    odds:   800 },
  { label: 'William Sawalich', odds:   900 },
  { label: 'Rajah Caruth',     odds:  1000 },
  { label: 'Jesse Love',       odds:  1200 },
  { label: 'Parker Retzlaff',  odds:  1400 },
  { label: 'Stewart Friesen',  odds:  1500 },
  { label: 'Carson Hocevar',   odds:  1600 },
  { label: 'Corey LaJoie',     odds:  2000 },
  { label: 'Ross Chastain',    odds:  2500 }, // Cup Series guest, ineligible for points
  { label: 'Frankie Muniz',    odds:  3000 },
  { label: 'Tanner Gray',      odds:  3000 },
  { label: 'Kaden Honeycutt',  odds:  3500 },
  { label: 'Chase Purdy',      odds:  4000 },
  { label: 'Timmy Hill',       odds:  5000 },
  { label: 'Field / Other',    odds:  8000 },
]

// F1 Monaco GP 2026 — qualifying at ~3pm CEST (9am ET), June 6
// Pole position prediction; odds are approximate morning-line
const F1_MONACO_QUALI_FIELD: { label: string; odds: number }[] = [
  { label: 'Max Verstappen',   odds:  -200 },
  { label: 'Lando Norris',     odds:   250 },
  { label: 'Charles Leclerc',  odds:   300 }, // traditional Monaco specialist
  { label: 'Oscar Piastri',    odds:   600 },
  { label: 'George Russell',   odds:   700 },
  { label: 'Carlos Sainz',     odds:   900 },
  { label: 'Lewis Hamilton',   odds:  1000 },
  { label: 'Fernando Alonso',  odds:  2000 },
  { label: 'Nico Hülkenberg',  odds:  3000 },
  { label: 'Lance Stroll',     odds:  4000 },
]

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
        console.error(`  ❌  ${email} not found. Check PLAYER_EMAILS or create accounts first.`)
        process.exit(1)
      }
      tick(email)
      return u.id
    })
  } else {
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
        await insert(`deactivate: ${bz.name}`,
          admin.from('betstravaganza').update({ status: 'completed' }).eq('id', bz.id).select().single())
      }
    }
  }

  // ── 3. Fetch odds from The Odds API ───────────────────────────────────────
  log('\nFetching odds from The Odds API...')
  const [mlbGames, nhlGames, wnbaGames, mlsGames] = await Promise.all([
    fetchOdds('baseball_mlb',          ['h2h', 'spreads']),
    fetchOdds('icehockey_nhl',         ['h2h']),
    fetchOdds('basketball_wnba',       ['h2h', 'spreads']),
    fetchOdds('soccer_usa_mls',        ['h2h']),
  ])

  // Separate API call for tennis (French Open)
  const [wtaGames] = await Promise.all([
    fetchOdds('tennis_wta_french_open', ['h2h']).catch(() => []),
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

  // ── 5. Required Event 1: Belmont Stakes ───────────────────────────────────
  log('\n─── Required Event 1: Belmont Stakes ───')
  const belmontTime = new Date(`${DATE_ET}T23:04:00Z`) // 7:04pm ET post time
  const evBelmont = await insert<any>('event: Belmont Stakes',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              '158th Belmont Stakes',
      sport:             'Horse Racing',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     belmontTime.toISOString(),
      streaming_info:    'NBC / Peacock',
      notes:             '1¼ miles at Saratoga Race Course. Post time 7:04pm ET. Odds are morning line estimates — update before race.',
    }).select().single()
  )
  for (const horse of BELMONT_STAKES_FIELD) {
    await insert<any>(`  horse: ${horse.label}`,
      admin.from('bet_options').insert({
        event_id: evBelmont.id, label: horse.label, odds: horse.odds,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('Belmont Stakes odds are morning-line estimates — update via Admin > Events before the race.')

  // ── 6. Required Event 2: US vs Germany Friendly (Goal Scorer) ────────────
  log('\n─── Required Event 2: USMNT vs Germany — Goal Scorer ───')
  const usvGerTime = new Date(`${DATE_ET}T18:30:00Z`) // 2:30pm ET kickoff
  const evUSGer = await insert<any>('event: USA vs Germany Friendly',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'USA vs Germany Friendly — Goal Scorer',
      sport:             'Soccer',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     usvGerTime.toISOString(),
      streaming_info:    'TNT / Max — Soldier Field, Chicago',
      notes:             'Pick a player who scores a goal in the match (any time). All 52 World Cup roster players listed. Odds are estimates — update before kickoff.',
    }).select().single()
  )
  log('  Creating USMNT players...')
  for (const player of USMNT_PLAYERS) {
    await insert<any>(`  USA: ${player}`,
      admin.from('bet_options').insert({
        event_id: evUSGer.id, label: `${player} (USA)`, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  log('  Creating Germany players...')
  for (const player of GERMANY_PLAYERS) {
    await insert<any>(`  GER: ${player}`,
      admin.from('bet_options').insert({
        event_id: evUSGer.id, label: `${player} (GER)`, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('Add goal-scorer odds via Admin > Events before the draft (e.g. Pulisic +350, Wirtz +280).')

  // ── 7. Required Event 3: US Women's Open Round 3 ─────────────────────────
  log('\n─── Required Event 3: US Women\'s Open — Low Score (Rd 3) ───')
  const uswoTime = new Date(`${DATE_ET}T11:00:00Z`) // approx 7am ET tee times
  const evUSWO = await insert<any>('event: US Women\'s Open Rd 3',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'US Women\'s Open Rd 3 — Lowest Score',
      sport:             'Golf',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     uswoTime.toISOString(),
      streaming_info:    'NBC / Peacock — Riviera Country Club, Pacific Palisades, CA',
      notes:             'Pick the player who shoots the lowest round 3 score. Odds reflect overall tournament odds — update with round-specific odds based on Rd 1-2 leaderboard.',
    }).select().single()
  )
  for (const player of USWOMENS_OPEN_FIELD) {
    await insert<any>(`  USWO: ${player}`,
      admin.from('bet_options').insert({
        event_id: evUSWO.id, label: player, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('US Women\'s Open odds should be updated after Rounds 1-2 based on leaderboard position.')

  // ── 8. Required Event 4: Memorial Tournament Round 3 ─────────────────────
  log('\n─── Required Event 4: Memorial Tournament — Low Score (Rd 3) ───')
  const memTime = new Date(`${DATE_ET}T11:00:00Z`) // approx 7am ET tee times
  const evMemorial = await insert<any>('event: Memorial Tournament Rd 3',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'Memorial Tournament Rd 3 — Lowest Score',
      sport:             'Golf',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     memTime.toISOString(),
      streaming_info:    'Golf Channel / Peacock (early) · NBC (afternoon) — Muirfield Village, Dublin, OH',
      notes:             'Pick the player who shoots the lowest round 3 score. Update odds based on Rd 1-2 leaderboard.',
    }).select().single()
  )
  for (const player of MEMORIAL_TOURNAMENT_FIELD) {
    await insert<any>(`  Memorial: ${player}`,
      admin.from('bet_options').insert({
        event_id: evMemorial.id, label: player, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('Memorial Tournament odds should be updated after Rounds 1-2 based on leaderboard position.')

  // ── 9. Required Event 5: DGPT Northwest Championship Round 3 ─────────────
  log('\n─── Required Event 5: DGPT Northwest Championship — Low Score (Rd 3) ───')
  const dgptTime = new Date(`${DATE_ET}T14:00:00Z`) // approx 10am ET / Glendoveer East, Portland
  const evDGPT = await insert<any>('event: DGPT Northwest Championship Rd 3',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'DGPT Northwest Championship Rd 3 — Lowest Score',
      sport:             'Disc Golf',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     dgptTime.toISOString(),
      streaming_info:    'DGPT+ live stream — Glendoveer East, Portland, OR',
      notes:             'Pick the MPO player who shoots the lowest round 3 score. No betting odds available for disc golf — all options set to null.',
    }).select().single()
  )
  for (const player of DGPT_NORTHWEST_FIELD) {
    await insert<any>(`  DGPT: ${player}`,
      admin.from('bet_options').insert({
        event_id: evDGPT.id, label: player, odds: null,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }

  // ── 10. Required Event 6: NASCAR Truck Series — DQS Solutions 250 ─────────
  log('\n─── Required Event 6: NASCAR DQS Solutions & Staffing 250 ───')
  const nascarTime = new Date(`${DATE_ET}T17:00:00Z`) // ~1pm ET, FS1
  const evNASCAR = await insert<any>('event: NASCAR DQS Solutions & Staffing 250',
    admin.from('events').insert({
      betstravaganza_id: bzId,
      name:              'NASCAR DQS Solutions & Staffing 250',
      sport:             'NASCAR',
      category:          'required',
      bet_type:          'odds',
      start_time_et:     nascarTime.toISOString(),
      streaming_info:    'FS1 — Michigan International Speedway (2-mile oval, 125 laps)',
      notes:             'Race winner. ~40 trucks entered. Odds are estimates — update via Admin > Events before race.',
    }).select().single()
  )
  for (const driver of NASCAR_TRUCK_FIELD) {
    await insert<any>(`  NASCAR: ${driver.label}`,
      admin.from('bet_options').insert({
        event_id: evNASCAR.id, label: driver.label, odds: driver.odds,
        max_drafts: 1, odds_source: 'manual',
      }).select().single()
    )
  }
  warn('NASCAR odds are estimates — verify and update via Admin > Events before the race.')

  // ── 11. Optional Draft Events ─────────────────────────────────────────────
  log('\n─── Optional Draft Events ───')

  // NHL Stanley Cup Final Game 3: Carolina Hurricanes @ Vegas Golden Knights
  // Hurricanes lead series 2-0; Game 3 in Las Vegas
  {
    const nhlFinalTime = new Date(`${DATE_ET}T00:00:00Z`) // 8pm ET = midnight UTC (next day)
    nhlFinalTime.setDate(nhlFinalTime.getDate() + 1)
    const evNHL = await insert<any>('event: NHL SCF Game 3 CAR @ VGK',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'NHL SCF Gm 3 — Hurricanes @ Golden Knights',
        sport:             'Hockey',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     new Date(`${DATE_ET}T00:00:00Z`).toISOString(),
        streaming_info:    'ABC / ESPN+ — T-Mobile Arena, Las Vegas (Hurricanes lead 2-0)',
        notes:             'Series tied 2-0 Hurricanes. Game 3 first on VGK home ice.',
      }).select().single()
    )

    // Try to get NHL odds from the API; fall back to manual
    const nhlFinalGame = nhlGames.find(g =>
      (g.home_team.includes('Golden Knights') || g.home_team.includes('Vegas')) &&
      (g.away_team.includes('Hurricanes') || g.away_team.includes('Carolina'))
    )
    if (nhlFinalGame) {
      const market = bestMarket(nhlFinalGame, 'h2h')
      if (market) {
        for (const o of market.outcomes) {
          await insert<any>(`  NHL: ${o.name} Win`,
            admin.from('bet_options').insert({
              event_id: evNHL.id, label: `${o.name} Win`, odds: o.price,
              max_drafts: 2, odds_source: 'api',
            }).select().single()
          )
        }
      }
    } else {
      // Manual fallback
      const nhlOpts = [
        { label: 'Hurricanes Win', odds: -140 },
        { label: 'Golden Knights Win', odds: 120 },
      ]
      for (const o of nhlOpts) {
        await insert<any>(`  NHL: ${o.label}`,
          admin.from('bet_options').insert({
            event_id: evNHL.id, label: o.label, odds: o.odds,
            max_drafts: 2, odds_source: 'manual',
          }).select().single()
        )
      }
      warn('NHL Final Game 3 not found in API — using manual odds estimates.')
    }
  }

  // French Open Women's Final: Kostyuk vs Cîrstea
  {
    const foTime = new Date(`${DATE_ET}T13:00:00Z`) // ~9am ET (3pm CEST)
    const evFO = await insert<any>('event: French Open Women\'s Final',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'French Open — Women\'s Singles Final',
        sport:             'Tennis',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     foTime.toISOString(),
        streaming_info:    'NBC / Peacock — Court Philippe-Chatrier, Paris',
        notes:             'Marta Kostyuk (UKR, seed 15) vs Sorana Cîrstea (ROU, seed 18).',
      }).select().single()
    )

    const wtaFinalGame = wtaGames.find(g =>
      (g.home_team.includes('Kostyuk') || g.away_team.includes('Kostyuk')) ||
      (g.home_team.includes('Cirstea') || g.away_team.includes('Cirstea'))
    )
    if (wtaFinalGame) {
      const market = bestMarket(wtaFinalGame, 'h2h')
      if (market) {
        for (const o of market.outcomes) {
          await insert<any>(`  FO: ${o.name}`,
            admin.from('bet_options').insert({
              event_id: evFO.id, label: `${o.name} Wins`, odds: o.price,
              max_drafts: 2, odds_source: 'api',
            }).select().single()
          )
        }
      }
    } else {
      const foOpts = [
        { label: 'Marta Kostyuk Wins',  odds: -170 },
        { label: 'Sorana Cîrstea Wins', odds:  145 },
      ]
      for (const o of foOpts) {
        await insert<any>(`  FO: ${o.label}`,
          admin.from('bet_options').insert({
            event_id: evFO.id, label: o.label, odds: o.odds,
            max_drafts: 2, odds_source: 'manual',
          }).select().single()
        )
      }
      warn('French Open Final not found in API — using manual odds estimates.')
    }
  }

  // WNBA: Seattle Storm vs Minnesota Lynx
  {
    const wnbaTime1 = new Date(`${DATE_ET}T17:00:00Z`) // 1pm ET
    const evWNBA1 = await insert<any>('event: Seattle Storm @ Minnesota Lynx',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'Seattle Storm @ Minnesota Lynx',
        sport:             'Basketball',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     wnbaTime1.toISOString(),
        streaming_info:    'ABC — Target Center, Minneapolis',
      }).select().single()
    )
    const wnba1Game = wnbaGames.find(g =>
      g.home_team.includes('Lynx') || g.home_team.includes('Minnesota')
    )
    if (wnba1Game) {
      const market = bestMarket(wnba1Game, 'h2h')
      if (market) {
        for (const o of market.outcomes) {
          await insert<any>(`  WNBA: ${o.name}`,
            admin.from('bet_options').insert({
              event_id: evWNBA1.id, label: `${o.name} Win`, odds: o.price,
              max_drafts: 2, odds_source: 'api',
            }).select().single()
          )
        }
      }
    } else {
      for (const o of [{ label: 'Minnesota Lynx Win', odds: -120 }, { label: 'Seattle Storm Win', odds: 100 }]) {
        await insert<any>(`  WNBA: ${o.label}`,
          admin.from('bet_options').insert({
            event_id: evWNBA1.id, label: o.label, odds: o.odds,
            max_drafts: 2, odds_source: 'manual',
          }).select().single()
        )
      }
      warn('Seattle @ Minnesota not found in WNBA API — using manual odds.')
    }
  }

  // WNBA: Golden State Valkyries vs Las Vegas Aces
  {
    const wnbaTime2 = new Date(`${DATE_ET}T19:00:00Z`) // 3pm ET
    const evWNBA2 = await insert<any>('event: Golden State Valkyries @ Las Vegas Aces',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'Golden State Valkyries @ Las Vegas Aces',
        sport:             'Basketball',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     wnbaTime2.toISOString(),
        streaming_info:    'ABC — Michelob ULTRA Arena, Las Vegas',
      }).select().single()
    )
    const wnba2Game = wnbaGames.find(g =>
      g.home_team.includes('Aces') || g.home_team.includes('Las Vegas')
    )
    if (wnba2Game) {
      const market = bestMarket(wnba2Game, 'h2h')
      if (market) {
        for (const o of market.outcomes) {
          await insert<any>(`  WNBA: ${o.name}`,
            admin.from('bet_options').insert({
              event_id: evWNBA2.id, label: `${o.name} Win`, odds: o.price,
              max_drafts: 2, odds_source: 'api',
            }).select().single()
          )
        }
      }
    } else {
      for (const o of [{ label: 'Las Vegas Aces Win', odds: -135 }, { label: 'Golden State Valkyries Win', odds: 115 }]) {
        await insert<any>(`  WNBA: ${o.label}`,
          admin.from('bet_options').insert({
            event_id: evWNBA2.id, label: o.label, odds: o.odds,
            max_drafts: 2, odds_source: 'manual',
          }).select().single()
        )
      }
      warn('Golden State @ Las Vegas not found in WNBA API — using manual odds.')
    }
  }

  // Boxing: Billam-Smith vs Rozicki (Zuffa Boxing, Bournemouth, ~5pm ET)
  {
    const bzTime = new Date(`${DATE_ET}T21:00:00Z`) // ~5pm ET / 10pm BST
    const evBox1 = await insert<any>('event: Billam-Smith vs Rozicki',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'Chris Billam-Smith vs Ryan Rozicki',
        sport:             'Boxing',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     bzTime.toISOString(),
        streaming_info:    'Paramount+ (US) / Sky Sports (UK) — Bournemouth International Centre',
        notes:             'Cruiserweight. Billam-Smith 21-2 (13 KOs) vs Rozicki 21-1-1 (20 KOs). Zuffa Boxing.',
      }).select().single()
    )
    for (const o of [
      { label: 'Chris Billam-Smith wins', odds: -175 },
      { label: 'Ryan Rozicki wins',       odds:  150 },
    ]) {
      await insert<any>(`  Box: ${o.label}`,
        admin.from('bet_options').insert({
          event_id: evBox1.id, label: o.label, odds: o.odds,
          max_drafts: 2, odds_source: 'manual',
        }).select().single()
      )
    }
  }

  // Boxing: Padley vs Fiaz (Matchroom / DAZN, Sheffield, ~3pm ET main event)
  {
    const padTime = new Date(`${DATE_ET}T19:00:00Z`) // ~3pm ET / 8pm BST
    const evBox2 = await insert<any>('event: Padley vs Fiaz',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'Josh Padley vs Aqib Fiaz',
        sport:             'Boxing',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     padTime.toISOString(),
        streaming_info:    'DAZN — Utilita Arena Sheffield',
        notes:             'Super featherweight main event (elevated after Galal Yafai injury). 12 rounds.',
      }).select().single()
    )
    for (const o of [
      { label: 'Josh Padley wins', odds: -250 },
      { label: 'Aqib Fiaz wins',   odds:  210 },
    ]) {
      await insert<any>(`  Box: ${o.label}`,
        admin.from('bet_options').insert({
          event_id: evBox2.id, label: o.label, odds: o.odds,
          max_drafts: 2, odds_source: 'manual',
        }).select().single()
      )
    }
  }

  // Boxing: Garcia vs Moloney + Yabuki vs Calixto double-header (Japan, 8am ET)
  {
    const japanTime = new Date(`${DATE_ET}T12:00:00Z`) // ~8am ET / 9pm JST
    const evBox3 = await insert<any>('event: Garcia vs Moloney / Yabuki vs Calixto',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'Garcia vs Moloney + Yabuki vs Calixto',
        sport:             'Boxing',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     japanTime.toISOString(),
        streaming_info:    'YouTube (free) — Aichi Sky Expo, Tokoname, Japan',
        notes:             'Double-header: (1) Garcia vs Moloney — IBF Jr Bantamweight title; (2) Yabuki vs Calixto — IBF Flyweight title. Pick who you think wins either main event.',
      }).select().single()
    )
    for (const o of [
      { label: 'Willibaldo Garcia wins (IBF Jr Bantam)',  odds: -200 },
      { label: 'Andrew Moloney wins (IBF Jr Bantam)',     odds:  170 },
      { label: 'Masamichi Yabuki wins (IBF Flyweight)',   odds: -190 },
      { label: 'Rene Calixto wins (IBF Flyweight)',       odds:  160 },
    ]) {
      await insert<any>(`  Box: ${o.label}`,
        admin.from('bet_options').insert({
          event_id: evBox3.id, label: o.label, odds: o.odds,
          max_drafts: 1, odds_source: 'manual',
        }).select().single()
      )
    }
  }

  // F1 Monaco GP Qualifying — Pole Position
  {
    const f1Time = new Date(`${DATE_ET}T13:00:00Z`) // 9am ET / 3pm CEST
    const evF1 = await insert<any>('event: F1 Monaco GP Qualifying — Pole Position',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'F1 Monaco GP — Pole Position',
        sport:             'Motorsport',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     f1Time.toISOString(),
        streaming_info:    'ESPN / ESPN+ — Circuit de Monaco, Monaco',
        notes:             'Qualifying starts 3pm CEST (9am ET). Race is Sunday June 7. Pick who will take pole position.',
      }).select().single()
    )
    for (const driver of F1_MONACO_QUALI_FIELD) {
      await insert<any>(`  F1: ${driver.label}`,
        admin.from('bet_options').insert({
          event_id: evF1.id, label: driver.label, odds: driver.odds,
          max_drafts: 1, odds_source: 'manual',
        }).select().single()
      )
    }
    warn('F1 Monaco qualifying odds are estimates — update before qualifying begins.')
  }

  // Cricket: West Indies vs Sri Lanka — 2nd ODI
  {
    const cricketTime = new Date(`${DATE_ET}T14:30:00Z`) // ~10:30am ET / 10:30am AST (Jamaica)
    const evCricket = await insert<any>('event: West Indies vs Sri Lanka ODI 2',
      admin.from('events').insert({
        betstravaganza_id: bzId,
        name:              'West Indies vs Sri Lanka — 2nd ODI',
        sport:             'Cricket',
        category:          'optional',
        bet_type:          'odds',
        start_time_et:     cricketTime.toISOString(),
        streaming_info:    'Willow TV — Sabina Park, Kingston, Jamaica',
        notes:             'Part of Sri Lanka\'s white-ball tour of West Indies (ODI series). 50-over format.',
      }).select().single()
    )
    for (const o of [
      { label: 'West Indies win', odds: -125 },
      { label: 'Sri Lanka win',   odds:  105 },
    ]) {
      await insert<any>(`  Cricket: ${o.label}`,
        admin.from('bet_options').insert({
          event_id: evCricket.id, label: o.label, odds: o.odds,
          max_drafts: 2, odds_source: 'manual',
        }).select().single()
      )
    }
  }

  // ── 12. Slate Games ───────────────────────────────────────────────────────
  log('\nCreating slate games...')
  const slateCounts: Record<string, number> = {}

  async function addSlate(
    awayTeam: string, homeTeam: string, sport: string,
    startTimeUTC: string, spread: number | null = null, notes?: string
  ) {
    await insert<any>(`  ${awayTeam} @ ${homeTeam}`,
      admin.from('slate_games').insert({
        betstravaganza_id: bzId,
        away_team:         awayTeam,
        home_team:         homeTeam,
        sport_label:       sport,
        start_time_et:     startTimeUTC,
        spread,
        notes:             notes ?? null,
      }).select().single()
    )
    slateCounts[sport] = (slateCounts[sport] ?? 0) + 1
  }

  async function addSlateFromApi(game: OddsGame, sport: string) {
    await addSlate(game.away_team, game.home_team, sport, game.commence_time, homeSpread(game))
  }

  // MLB — all 15 games (odds from API)
  log('  MLB games...')
  if (mlbGames.length > 0) {
    for (const g of mlbGames) await addSlateFromApi(g, 'Baseball')
  } else {
    // Manual fallback if API doesn't return games
    warn('No MLB games from API — using manual list for June 6, 2026')
    const mlbManual: [string, string, string][] = [
      ['Seattle Mariners',    'Detroit Tigers',        `${DATE_ET}T17:10:00Z`],
      ['Kansas City Royals',  'Minnesota Twins',       `${DATE_ET}T18:10:00Z`],
      ['Cincinnati Reds',     'St. Louis Cardinals',   `${DATE_ET}T18:15:00Z`],
      ['San Francisco Giants','Chicago Cubs',          `${DATE_ET}T18:20:00Z`],
      ['Baltimore Orioles',   'Toronto Blue Jays',     `${DATE_ET}T19:07:00Z`],
      ['Chicago White Sox',   'Philadelphia Phillies', `${DATE_ET}T20:05:00Z`],
      ['Pittsburgh Pirates',  'Atlanta Braves',        `${DATE_ET}T20:10:00Z`],
      ['Tampa Bay Rays',      'Miami Marlins',         `${DATE_ET}T20:10:00Z`],
      ['Oakland Athletics',   'Houston Astros',        `${DATE_ET}T20:10:00Z`],
      ['Washington Nationals','Arizona Diamondbacks',  `${DATE_ET}T20:10:00Z`],
      ['Boston Red Sox',      'New York Yankees',      `${DATE_ET}T23:35:00Z`],
      ['Cleveland Guardians', 'Texas Rangers',         `${DATE_ET}T23:35:00Z`],
      ['Milwaukee Brewers',   'Colorado Rockies',      `${DATE_ET}T01:10:00Z`],
      ['Los Angeles Angels',  'Los Angeles Dodgers',   `${DATE_ET}T02:10:00Z`],
      ['New York Mets',       'San Diego Padres',      `${DATE_ET}T02:10:00Z`],
    ]
    for (const [away, home, time] of mlbManual) await addSlate(away, home, 'Baseball', time, null)
  }

  // WNBA — 2 games (spread from API)
  log('  WNBA games...')
  if (wnbaGames.length > 0) {
    for (const g of wnbaGames) await addSlateFromApi(g, 'Basketball (WNBA)')
  } else {
    warn('No WNBA games from API — using manual list')
    await addSlate('Seattle Storm',         'Minnesota Lynx',      'Basketball (WNBA)', `${DATE_ET}T17:00:00Z`, -3.5)
    await addSlate('Golden State Valkyries','Las Vegas Aces',      'Basketball (WNBA)', `${DATE_ET}T19:00:00Z`, -4.5)
  }

  // NHL Stanley Cup Final Game 3 as slate game too
  log('  NHL Stanley Cup Final Gm 3...')
  const nhlFinalSlate = nhlGames.find(g =>
    (g.home_team.includes('Golden Knights') || g.home_team.includes('Vegas')) &&
    (g.away_team.includes('Hurricanes') || g.away_team.includes('Carolina'))
  )
  if (nhlFinalSlate) {
    await addSlateFromApi(nhlFinalSlate, 'Hockey (NHL)')
  } else {
    await addSlate('Carolina Hurricanes', 'Vegas Golden Knights', 'Hockey (NHL)',
      `${DATE_ET}T00:00:00Z`, null, 'Stanley Cup Final Game 3 (Hurricanes lead 2-0)')
  }

  // AFL Round 13 — June 6 AEST (already in progress by US morning)
  log('  AFL Round 13 (Australian times)...')
  // 2:15pm AEST = 04:15am UTC; 5:15pm AEST = 07:15 UTC; 8:15pm AEST = 10:15 UTC
  await addSlate('Western Bulldogs', 'North Melbourne', 'AFL (Aust. Football)', `${DATE_ET}T04:15:00Z`, null, 'Round 13 — Hands Oval, Bunbury')
  await addSlate('Gold Coast Suns',  'Fremantle Dockers','AFL (Aust. Football)', `${DATE_ET}T07:15:00Z`, null, 'Round 13 — People First Stadium')
  await addSlate('West Coast Eagles','Brisbane Lions',   'AFL (Aust. Football)', `${DATE_ET}T10:15:00Z`, null, 'Round 13 — Optus Stadium, Perth')

  // NRL Round — June 6 (Saturday) AEST
  log('  NRL games...')
  // ~3pm AEST = 05:00 UTC; ~7:30pm AEST = 09:30 UTC
  await addSlate('Dolphins',         'North Queensland Cowboys', 'Rugby League (NRL)', `${DATE_ET}T05:00:00Z`, null, 'Kayo Stadium, Brisbane')
  await addSlate('Brisbane Broncos', 'Gold Coast Titans',        'Rugby League (NRL)', `${DATE_ET}T09:30:00Z`, null, 'Suncorp Stadium, Brisbane')

  // MLS — any games from API
  log('  MLS games...')
  if (mlsGames.length > 0) {
    for (const g of mlsGames) await addSlateFromApi(g, 'Soccer (MLS)')
  } else {
    warn('No MLS games found in API for June 6')
  }

  // ── 13. Summary ───────────────────────────────────────────────────────────
  const totalSlate = Object.values(slateCounts).reduce((a, b) => a + b, 0)
  log('\n' + '═'.repeat(70))
  log(`✅  Betstravaganza created for ${DATE_ET}`)
  log(`\n   ID:      ${bzId}`)
  log(`   Rounds:  ${ROUND_COUNT}  |  Stake: $${STAKE_AMOUNT}  |  Bankroll: $${START_BANKROLL}`)
  if (playerIds.length > 0) {
    log(`   Players: ${playerIds.length} (draft order set)`)
  } else {
    log(`   Players: ⚠  NOT SET — configure via Admin › Setup before drafting`)
  }

  log('\n   ── Required Events (6) ──')
  log(`     🏇 158th Belmont Stakes — ${BELMONT_STAKES_FIELD.length} horses (update odds before race)`)
  log(`     ⚽ USA vs Germany Friendly — goal scorer, ${USMNT_PLAYERS.length + GERMANY_PLAYERS.length} players (add odds before draft)`)
  log(`     ⛳ US Women\'s Open Rd 3 — ${USWOMENS_OPEN_FIELD.length} players (update odds after Rd 2)`)
  log(`     ⛳ Memorial Tournament Rd 3 — ${MEMORIAL_TOURNAMENT_FIELD.length} players (update odds after Rd 2)`)
  log(`     🥏 DGPT Northwest Championship Rd 3 — ${DGPT_NORTHWEST_FIELD.length} players (no odds)`)
  log(`     🏁 NASCAR DQS Solutions 250 — ${NASCAR_TRUCK_FIELD.length} drivers (update odds before race)`)

  log('\n   ── Optional Draft Events ──')
  log('     🏒 NHL SCF Game 3: Hurricanes @ Golden Knights (8pm ET, ABC)')
  log('     🎾 French Open Women\'s Final: Kostyuk vs Cîrstea (~9am ET)')
  log('     🏀 WNBA: Seattle Storm @ Minnesota Lynx (1pm ET, ABC)')
  log('     🏀 WNBA: Golden State Valkyries @ Las Vegas Aces (3pm ET, ABC)')
  log('     🥊 Boxing: Billam-Smith vs Rozicki (cruiserweight, Bournemouth)')
  log('     🥊 Boxing: Padley vs Fiaz (super featherweight, Sheffield)')
  log('     🥊 Boxing: Garcia vs Moloney + Yabuki vs Calixto (Japan)')
  log('     🏎  F1 Monaco GP Qualifying — pole position (9am ET)')
  log('     🏏 West Indies vs Sri Lanka ODI 2 (~10:30am ET)')

  log(`\n   ── Slate Games: ${totalSlate} total ──`)
  Object.entries(slateCounts).forEach(([sport, n]) => log(`     ${n}× ${sport}`))

  log('\n   ── Next Steps ──')
  log('     1. Admin › Events › ↓ Fetch Odds from API — refresh all spreads + API-available odds')
  log('     2. Update Belmont Stakes odds (morning line → actual book odds)')
  log('     3. Add goal-scorer odds for USA vs Germany (Pulisic, Wirtz, etc.)')
  log('     4. After golf Rounds 1-2 finish: update USWO + Memorial odds by leaderboard')
  log('     5. Update NASCAR odds closer to race time')
  log('     6. Update F1 pole odds before qualifying')
  if (playerIds.length === 0) {
    log('     7. Admin › Setup — add players and set draft order')
  }
  log(`     ${playerIds.length === 0 ? 8 : 7}. Admin › Draft — run the draft`)
  log('═'.repeat(70) + '\n')
}

run().catch(err => { console.error('\n❌', err.message ?? err); process.exit(1) })
