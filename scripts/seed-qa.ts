/**
 * QA seed: 6 players, 20 events, 66-pick complete snake draft, results in two
 * time-separated batches, 10 slate games (6 with results), all players with
 * confidence picks, and 2 manual bonuses.
 *
 * Run locally:
 *   npm run db:seed-qa
 *
 * Env required (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq < 1 || line.startsWith('#')) continue
    const k = line.slice(0, eq).trim()
    if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim()
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function ok<T>(label: string, res: { data: T | null; error: any }): Promise<T> {
  if (res.error) { console.error(`  ❌  ${label}: ${res.error.message}`); process.exit(1) }
  console.log(`  ✓  ${label}`)
  return res.data as T
}

// Timestamps for two result batches (~4 hours apart)
const BATCH1_TS = '2026-05-31T10:00:00.000Z'
const BATCH2_TS = '2026-05-31T14:00:00.000Z'

// Game times on the event day (June 6 2026)
function gt(hour: number, min = 0) {
  return new Date(`2026-06-06T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00-04:00`).toISOString()
}

async function run() {
  console.log('\n📦  Seeding QA data...\n')

  const adminEmail = process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
  if (!adminEmail) { console.error('❌  Missing NEXT_PUBLIC_INITIAL_ADMIN_EMAIL'); process.exit(1) }

  // ── 1. Auth users ─────────────────────────────────────────────────────────

  console.log('Resolving auth users...')

  const testPlayers = [
    { email: 'bob@example.com',    password: 'Password123!', name: 'Bob Martinez',    team: 'Chaos Theory',  nickname: 'We bring the chaos'   },
    { email: 'charlie@example.com',password: 'Password123!', name: 'Charlie Kim',     team: 'Lucky Sevens',  nickname: 'Lucky on every 7'      },
    { email: 'diana@example.com',  password: 'Password123!', name: 'Diana Zhang',     team: 'The Dream Team',nickname: 'Dream big'              },
    { email: 'ethan@example.com',  password: 'Password123!', name: 'Ethan Brooks',    team: 'Thunder Squad', nickname: 'Loud and proud'         },
    { email: 'fiona@example.com',  password: 'Password123!', name: 'Fiona Nakamura',  team: 'Golden Picks',  nickname: 'All that glitters'      },
  ]

  const { data: authList } = await db.auth.admin.listUsers()

  let adminAuthUser = authList?.users.find(u => u.email === adminEmail)
  if (!adminAuthUser) {
    const { data: c, error } = await db.auth.admin.createUser({ email: adminEmail, password: 'DevAdmin123!', email_confirm: true })
    if (error) { console.error(`  ❌  Cannot create admin: ${error.message}`); process.exit(1) }
    adminAuthUser = c.user!
  }
  const adminId = adminAuthUser.id
  console.log(`  ✓  admin ${adminEmail}`)

  const { data: adminProfile } = await db.from('users').select('*').eq('id', adminId).maybeSingle()
  await ok(`profile ${adminEmail}`, await db.from('users').upsert({
    id: adminId, email: adminEmail,
    name: adminProfile?.name ?? 'Aaron',
    team_name: adminProfile?.team_name ?? "Aaron's Team",
    is_admin: true,
    nickname: adminProfile?.nickname ?? 'The Architect',
  }, { onConflict: 'id' }).select().single())

  const userIds: string[] = [adminId]

  for (const p of testPlayers) {
    const existing = authList?.users.find(u => u.email === p.email)
    if (existing) {
      userIds.push(existing.id)
      console.log(`  ↩  ${p.email} already exists`)
    } else {
      const { data, error } = await db.auth.admin.createUser({ email: p.email, password: p.password, email_confirm: true })
      if (error) { console.error(`  ❌  ${p.email}: ${error.message}`); process.exit(1) }
      userIds.push(data!.user!.id)
      console.log(`  ✓  ${p.email}`)
    }
  }

  // ── 2. User profiles ──────────────────────────────────────────────────────

  console.log('\nUpserting profiles...')
  for (let i = 0; i < testPlayers.length; i++) {
    const p = testPlayers[i]
    await ok(`profile ${p.email}`, await db.from('users').upsert({
      id: userIds[i + 1], email: p.email, name: p.name,
      team_name: p.team, is_admin: false, nickname: p.nickname,
    }, { onConflict: 'id' }).select().single())
  }

  // ── 3. Betstravaganza ─────────────────────────────────────────────────────

  console.log('\nCreating betstravaganza...')
  const bz = await ok('QA betstravaganza', await db.from('betstravaganza').insert({
    name:                  'QA Betstravaganza 2026',
    status:                'active',
    player_count:          6,
    round_count:           11,
    stake_amount:          100,
    starting_bankroll:     1100,
    confidence_multiplier: 3,
    draft_order:           userIds,
    current_round:         11,
    current_pick_index:    66,  // draft complete (6 × 11 = 66)
    start_datetime:        new Date('2026-06-06T13:00:00-04:00').toISOString(),
    end_datetime:          new Date('2026-06-06T23:00:00-04:00').toISOString(),
  }).select().single()) as any

  const bzId = bz.id as string

  // ── 4. Events ─────────────────────────────────────────────────────────────

  console.log('\nCreating events...')

  // [0-4] Required  [5-12] Optional H2H  [13-19] Optional multi-option
  const eventDefs = [
    // ── Required ──────────────────────────────────────────────────────────────
    { name: 'Belmont Stakes',         sport: 'Horse Racing', category: 'required', bet_type: 'odds',     start_time_et: gt(18,0),  streaming_info: 'NBC Sports', notes: null },
    { name: 'US Open Golf Final Round',sport: 'Golf',        category: 'required', bet_type: 'odds',     start_time_et: gt(14,0),  streaming_info: 'Peacock / NBC', notes: null },
    { name: 'NBA Finals MVP',          sport: 'Basketball',  category: 'required', bet_type: 'odds',     start_time_et: gt(20,0),  streaming_info: 'ABC', notes: null },
    { name: 'Wimbledon Men\'s Final',  sport: 'Tennis',      category: 'required', bet_type: 'no_odds',  start_time_et: gt(9,0),   streaming_info: 'ESPN', notes: null },
    { name: 'Stanley Cup Finals MVP',  sport: 'Hockey',      category: 'required', bet_type: 'odds',     start_time_et: gt(20,0),  streaming_info: 'TNT', notes: null },
    // ── Optional head-to-head ─────────────────────────────────────────────────
    { name: 'NBA Finals Game 3',       sport: 'Basketball',  category: 'optional', bet_type: 'spread',   start_time_et: gt(20,0),  streaming_info: 'ABC', notes: null },
    { name: 'Yankees @ Red Sox',       sport: 'Baseball',    category: 'optional', bet_type: 'odds',     start_time_et: gt(13,5),  streaming_info: 'ESPN', notes: null },
    { name: 'UFC 315 Main Event',      sport: 'MMA',         category: 'optional', bet_type: 'no_odds',  start_time_et: gt(22,0),  streaming_info: 'ESPN+', notes: 'Light Heavyweight Title' },
    { name: 'NASCAR Cup H2H Props',    sport: 'Motor Racing',category: 'optional', bet_type: 'odds',     start_time_et: gt(14,0),  streaming_info: 'FOX', notes: 'Hamlin vs Logano finishing position' },
    { name: 'F1 Monaco GP H2H',        sport: 'Formula 1',   category: 'optional', bet_type: 'odds',     start_time_et: gt(9,0),   streaming_info: 'ESPN', notes: 'Verstappen vs Hamilton H2H' },
    { name: 'CONCACAF Cup Final',      sport: 'Soccer',      category: 'optional', bet_type: 'odds',     start_time_et: gt(19,0),  streaming_info: 'FS1', notes: null },
    { name: 'Boxing WBC Title Fight',  sport: 'Boxing',      category: 'optional', bet_type: 'odds',     start_time_et: gt(21,0),  streaming_info: 'Showtime', notes: 'Tank Davis vs Lomachenko' },
    { name: 'NHL Playoff Game 5',      sport: 'Hockey',      category: 'optional', bet_type: 'spread',   start_time_et: gt(19,30), streaming_info: 'TNT', notes: null },
    // ── Optional multi-option ─────────────────────────────────────────────────
    { name: 'PGA Championship Winner', sport: 'Golf',        category: 'optional', bet_type: 'odds',     start_time_et: gt(8,0),   streaming_info: 'CBS', notes: null },
    { name: 'NASCAR Cup Race Winner',  sport: 'Motor Racing',category: 'optional', bet_type: 'odds',     start_time_et: gt(14,0),  streaming_info: 'FOX', notes: null },
    { name: 'Tour de France Stage Win',sport: 'Cycling',     category: 'optional', bet_type: 'odds',     start_time_et: gt(7,0),   streaming_info: 'Peacock', notes: null },
    { name: 'World Series Winner',     sport: 'Baseball',    category: 'optional', bet_type: 'odds',     start_time_et: gt(20,0),  streaming_info: 'FOX', notes: null },
    { name: 'Super Bowl LXI Winner',   sport: 'Football',    category: 'optional', bet_type: 'odds',     start_time_et: gt(18,30), streaming_info: 'CBS', notes: null },
    { name: 'UEFA Euro 2028 Winner',   sport: 'Soccer',      category: 'optional', bet_type: 'odds',     start_time_et: gt(15,0),  streaming_info: 'ESPN', notes: null },
    { name: 'Davis Cup Finals',        sport: 'Tennis',      category: 'optional', bet_type: 'odds',     start_time_et: gt(10,0),  streaming_info: 'Tennis Channel', notes: null },
  ]

  const events: any[] = []
  for (const e of eventDefs) {
    events.push(await ok(`event: ${e.name}`, await db.from('events').insert({ betstravaganza_id: bzId, ...e }).select().single()))
  }

  // ── 5. Bet options ────────────────────────────────────────────────────────

  console.log('\nCreating bet options...')

  // R = required (max_drafts=1), H = head-to-head optional (max_drafts=2), M = multi optional (max_drafts=2)
  const optionDefs: { ei: number; opts: { label: string; odds: number | null; max_drafts?: number }[] }[] = [
    // E0 Belmont Stakes (required, 6 horses)
    { ei: 0, opts: [
      { label: 'Firestorm',    odds:  450 },
      { label: 'Desert Wind',  odds:  280 },
      { label: 'Lucky Luna',   odds:  600 },
      { label: 'Blaze Runner', odds:  180 },
      { label: 'Silver Arrow', odds: 1200 },
      { label: 'Thunder Bolt', odds:  320 },
    ]},
    // E1 US Open Golf (required, 6 golfers)
    { ei: 1, opts: [
      { label: 'Scottie Scheffler', odds: -120 },
      { label: 'Rory McIlroy',      odds:  200 },
      { label: 'Xander Schauffele', odds:  350 },
      { label: 'Jon Rahm',          odds:  500 },
      { label: 'Collin Morikawa',   odds:  800 },
      { label: 'Viktor Hovland',    odds:  900 },
    ]},
    // E2 NBA Finals MVP (required, 6 players)
    { ei: 2, opts: [
      { label: 'LeBron James',  odds:  300 },
      { label: 'Stephen Curry', odds:  250 },
      { label: 'Jayson Tatum',  odds:  400 },
      { label: 'Nikola Jokic',  odds:  350 },
      { label: 'Kevin Durant',  odds:  500 },
      { label: 'Giannis',       odds:  600 },
    ]},
    // E3 Wimbledon Men's Final (required, 6 players, no_odds)
    { ei: 3, opts: [
      { label: 'Novak Djokovic', odds: null },
      { label: 'Carlos Alcaraz', odds: null },
      { label: 'Jannik Sinner',  odds: null },
      { label: 'Casper Ruud',    odds: null },
      { label: 'Taylor Fritz',   odds: null },
      { label: 'Holger Rune',    odds: null },
    ]},
    // E4 Stanley Cup Finals MVP (required, 6 players)
    { ei: 4, opts: [
      { label: 'Connor McDavid',    odds:  200 },
      { label: 'Nathan MacKinnon',  odds:  250 },
      { label: 'Auston Matthews',   odds:  300 },
      { label: 'Alex Ovechkin',     odds:  400 },
      { label: 'Sidney Crosby',     odds:  350 },
      { label: 'Nikita Kucherov',   odds:  450 },
    ]},
    // E5 NBA Finals Game 3 (H2H, max_drafts=2)
    { ei: 5, opts: [
      { label: 'Celtics -5.5', odds: -110, max_drafts: 2 },
      { label: 'Heat +5.5',    odds: -110, max_drafts: 2 },
    ]},
    // E6 Yankees @ Red Sox (H2H, max_drafts=2)
    { ei: 6, opts: [
      { label: 'Yankees Win', odds: -130, max_drafts: 2 },
      { label: 'Red Sox Win', odds:  110, max_drafts: 2 },
    ]},
    // E7 UFC 315 (H2H, no_odds, max_drafts=2)
    { ei: 7, opts: [
      { label: 'Pereira',   odds: null, max_drafts: 2 },
      { label: 'Adesanya',  odds: null, max_drafts: 2 },
    ]},
    // E8 NASCAR H2H (max_drafts=2)
    { ei: 8, opts: [
      { label: 'Hamlin',  odds: -115, max_drafts: 2 },
      { label: 'Logano',  odds: -105, max_drafts: 2 },
    ]},
    // E9 F1 Monaco H2H (max_drafts=2)
    { ei: 9, opts: [
      { label: 'Verstappen', odds: -140, max_drafts: 2 },
      { label: 'Hamilton',   odds:  120, max_drafts: 2 },
    ]},
    // E10 CONCACAF Cup Final (H2H, max_drafts=2)
    { ei: 10, opts: [
      { label: 'USA Win',    odds:  110, max_drafts: 2 },
      { label: 'Mexico Win', odds: -130, max_drafts: 2 },
    ]},
    // E11 Boxing WBC (H2H, max_drafts=2)
    { ei: 11, opts: [
      { label: 'Tank Davis',   odds: -180, max_drafts: 2 },
      { label: 'Lomachenko',   odds:  150, max_drafts: 2 },
    ]},
    // E12 NHL Playoff Game 5 (H2H spread, max_drafts=2)
    { ei: 12, opts: [
      { label: 'Oilers -1.5', odds: -120, max_drafts: 2 },
      { label: 'Flames +1.5', odds:  100, max_drafts: 2 },
    ]},
    // E13 PGA Championship (multi, max_drafts=2)
    { ei: 13, opts: [
      { label: 'Scheffler PGA', odds: -200, max_drafts: 2 },
      { label: 'McIlroy PGA',   odds:  300, max_drafts: 2 },
      { label: 'Rahm PGA',      odds:  500, max_drafts: 2 },
      { label: 'Koepka PGA',    odds:  800, max_drafts: 2 },
    ]},
    // E14 NASCAR Cup Race Winner (multi, max_drafts=2)
    { ei: 14, opts: [
      { label: 'Hamlin NASCAR',  odds:  350, max_drafts: 2 },
      { label: 'Logano NASCAR',  odds:  400, max_drafts: 2 },
      { label: 'Blaney NASCAR',  odds:  450, max_drafts: 2 },
      { label: 'Harvick NASCAR', odds:  600, max_drafts: 2 },
    ]},
    // E15 Tour de France Stage (multi, max_drafts=2)
    { ei: 15, opts: [
      { label: 'Pogacar',    odds:  180, max_drafts: 2 },
      { label: 'Vingegaard', odds:  200, max_drafts: 2 },
      { label: 'Evenepoel',  odds:  350, max_drafts: 2 },
      { label: 'Rodriguez',  odds:  550, max_drafts: 2 },
    ]},
    // E16 World Series Winner (multi, max_drafts=2)
    { ei: 16, opts: [
      { label: 'Dodgers', odds:  250, max_drafts: 2 },
      { label: 'Yankees', odds:  300, max_drafts: 2 },
      { label: 'Braves',  odds:  400, max_drafts: 2 },
      { label: 'Astros',  odds:  500, max_drafts: 2 },
    ]},
    // E17 Super Bowl LXI (multi, max_drafts=2)
    { ei: 17, opts: [
      { label: 'Chiefs',  odds:  300, max_drafts: 2 },
      { label: 'Eagles',  odds:  400, max_drafts: 2 },
      { label: '49ers',   odds:  500, max_drafts: 2 },
      { label: 'Cowboys', odds:  600, max_drafts: 2 },
    ]},
    // E18 UEFA Euro 2028 (multi, max_drafts=2)
    { ei: 18, opts: [
      { label: 'France',  odds:  250, max_drafts: 2 },
      { label: 'Spain',   odds:  300, max_drafts: 2 },
      { label: 'England', odds:  350, max_drafts: 2 },
      { label: 'Germany', odds:  400, max_drafts: 2 },
    ]},
    // E19 Davis Cup Finals (multi, max_drafts=2)
    { ei: 19, opts: [
      { label: 'Alcaraz Davis',  odds:  200, max_drafts: 2 },
      { label: 'Sinner Davis',   odds:  250, max_drafts: 2 },
      { label: 'Djokovic Davis', odds:  300, max_drafts: 2 },
      { label: 'Medvedev Davis', odds:  450, max_drafts: 2 },
    ]},
  ]

  // allOptions[ei][label] → option row
  const allOptions: Record<number, Record<string, any>> = {}
  for (const def of optionDefs) {
    allOptions[def.ei] = {}
    for (const o of def.opts) {
      const row = await ok(`  ${events[def.ei].name} → ${o.label}`,
        await db.from('bet_options').insert({
          event_id:    events[def.ei].id,
          label:       o.label,
          odds:        o.odds,
          max_drafts:  o.max_drafts ?? 1,
          odds_source: 'manual',
        }).select().single()
      )
      allOptions[def.ei][o.label] = row
    }
  }

  function opt(ei: number, label: string) {
    const o = allOptions[ei]?.[label]
    if (!o) throw new Error(`Option not found: event ${ei} "${label}"`)
    return o
  }

  // ── 6. Draft picks (66 total, snake order) ────────────────────────────────
  // Players: P0=Aaron P1=Bob P2=Charlie P3=Diana P4=Ethan P5=Fiona
  // Snake:   R1 fwd, R2 rev, R3 fwd, ... R11 fwd

  console.log('\nCreating draft picks...')

  // [roundNumber, pickIndex, playerIdx, eventIdx, optionLabel]
  type PickDef = [number, number, number, number, string]

  const pickDefs: PickDef[] = [
    // R1 fwd → all pick required E0 (Belmont Stakes horses)
    [1,  0, 0,  0, 'Firestorm'],
    [1,  1, 1,  0, 'Desert Wind'],
    [1,  2, 2,  0, 'Lucky Luna'],
    [1,  3, 3,  0, 'Blaze Runner'],
    [1,  4, 4,  0, 'Silver Arrow'],
    [1,  5, 5,  0, 'Thunder Bolt'],
    // R2 rev → all pick required E1 (US Open golfers)
    [2,  6, 5,  1, 'Scottie Scheffler'],
    [2,  7, 4,  1, 'Rory McIlroy'],
    [2,  8, 3,  1, 'Xander Schauffele'],
    [2,  9, 2,  1, 'Jon Rahm'],
    [2, 10, 1,  1, 'Collin Morikawa'],
    [2, 11, 0,  1, 'Viktor Hovland'],
    // R3 fwd → all pick required E2 (NBA Finals MVP)
    [3, 12, 0,  2, 'LeBron James'],
    [3, 13, 1,  2, 'Stephen Curry'],
    [3, 14, 2,  2, 'Jayson Tatum'],
    [3, 15, 3,  2, 'Nikola Jokic'],
    [3, 16, 4,  2, 'Kevin Durant'],
    [3, 17, 5,  2, 'Giannis'],
    // R4 rev → all pick required E3 (Wimbledon)
    [4, 18, 5,  3, 'Novak Djokovic'],
    [4, 19, 4,  3, 'Carlos Alcaraz'],
    [4, 20, 3,  3, 'Jannik Sinner'],
    [4, 21, 2,  3, 'Casper Ruud'],
    [4, 22, 1,  3, 'Taylor Fritz'],
    [4, 23, 0,  3, 'Holger Rune'],
    // R5 fwd → all pick required E4 (Stanley Cup MVP)
    [5, 24, 0,  4, 'Connor McDavid'],
    [5, 25, 1,  4, 'Nathan MacKinnon'],
    [5, 26, 2,  4, 'Auston Matthews'],
    [5, 27, 3,  4, 'Alex Ovechkin'],
    [5, 28, 4,  4, 'Sidney Crosby'],
    [5, 29, 5,  4, 'Nikita Kucherov'],
    // R6 rev → optional H2H CLASHes
    [6, 30, 5,  5, 'Celtics -5.5'],   // P5 Fiona
    [6, 31, 4,  5, 'Heat +5.5'],       // P4 Ethan ← CLASH
    [6, 32, 3,  6, 'Yankees Win'],     // P3 Diana
    [6, 33, 2,  6, 'Red Sox Win'],     // P2 Charlie ← CLASH
    [6, 34, 1,  7, 'Pereira'],         // P1 Bob
    [6, 35, 0,  7, 'Adesanya'],        // P0 Aaron ← CLASH
    // R7 fwd → more optional H2H CLASHes
    [7, 36, 0,  8, 'Hamlin'],          // P0 Aaron
    [7, 37, 1,  8, 'Logano'],          // P1 Bob ← CLASH
    [7, 38, 2,  9, 'Verstappen'],      // P2 Charlie
    [7, 39, 3,  9, 'Hamilton'],        // P3 Diana ← CLASH
    [7, 40, 4, 10, 'USA Win'],         // P4 Ethan
    [7, 41, 5, 10, 'Mexico Win'],      // P5 Fiona ← CLASH
    // R8 rev → more H2H + start multi-option
    [8, 42, 5, 11, 'Tank Davis'],      // P5 Fiona
    [8, 43, 4, 11, 'Lomachenko'],      // P4 Ethan ← CLASH
    [8, 44, 3, 12, 'Oilers -1.5'],    // P3 Diana
    [8, 45, 2, 12, 'Flames +1.5'],    // P2 Charlie ← CLASH
    [8, 46, 1, 13, 'Scheffler PGA'],   // P1 Bob
    [8, 47, 0, 13, 'McIlroy PGA'],     // P0 Aaron
    // R9 fwd → multi-option spreads
    [9, 48, 0, 13, 'Rahm PGA'],        // P0 Aaron (2nd PGA pick, different option)
    [9, 49, 1, 14, 'Hamlin NASCAR'],   // P1 Bob
    [9, 50, 2, 14, 'Logano NASCAR'],   // P2 Charlie
    [9, 51, 3, 15, 'Pogacar'],         // P3 Diana
    [9, 52, 4, 15, 'Vingegaard'],      // P4 Ethan
    [9, 53, 5, 16, 'Dodgers'],         // P5 Fiona
    // R10 rev → more multi-option
    [10, 54, 5, 16, 'Yankees'],        // P5 Fiona
    [10, 55, 4, 17, 'Chiefs'],         // P4 Ethan
    [10, 56, 3, 17, 'Eagles'],         // P3 Diana
    [10, 57, 2, 18, 'France'],         // P2 Charlie
    [10, 58, 1, 18, 'Spain'],          // P1 Bob
    [10, 59, 0, 19, 'Alcaraz Davis'],  // P0 Aaron
    // R11 fwd → finish it out
    [11, 60, 0, 18, 'England'],        // P0 Aaron
    [11, 61, 1, 13, 'Koepka PGA'],     // P1 Bob
    [11, 62, 2, 14, 'Blaney NASCAR'],  // P2 Charlie
    [11, 63, 3, 15, 'Evenepoel'],      // P3 Diana
    [11, 64, 4, 16, 'Braves'],         // P4 Ethan
    [11, 65, 5, 17, '49ers'],          // P5 Fiona
  ]

  for (const [round, pickIndex, playerIdx, ei, label] of pickDefs) {
    const userId = userIds[playerIdx]
    const option = opt(ei, label)
    await ok(
      `  R${round} idx${pickIndex} P${playerIdx} → ${label}`,
      await db.from('draft_picks').insert({
        betstravaganza_id: bzId,
        user_id:           userId,
        bet_option_id:     option.id,
        round_number:      round,
        pick_index:        pickIndex,
      }).select().single()
    )
  }

  // ── 7. Draft results (10 results in 2 batches) ────────────────────────────

  console.log('\nCreating draft results (batch 1)...')

  // Batch 1: E0-E2 required + E5 NBA Game 3 + E6 Yankees@RedSox
  const batch1Results = [
    {
      // E0 Belmont Stakes: Blaze Runner wins (P3 Diana wins, everyone else loses)
      event: events[0],
      winner_bet_option_ids: [opt(0, 'Blaze Runner').id],
      result_display: 'Blaze Runner wins the Belmont Stakes',
      home_score: null, away_score: null,
    },
    {
      // E1 US Open Golf: Scottie Scheffler wins (P5 Fiona wins)
      event: events[1],
      winner_bet_option_ids: [opt(1, 'Scottie Scheffler').id],
      result_display: 'Scottie Scheffler wins the US Open',
      home_score: null, away_score: null,
    },
    {
      // E2 NBA Finals MVP: Jayson Tatum wins (P2 Charlie wins)
      event: events[2],
      winner_bet_option_ids: [opt(2, 'Jayson Tatum').id],
      result_display: 'Jayson Tatum named NBA Finals MVP',
      home_score: null, away_score: null,
    },
    {
      // E5 NBA Finals Game 3: Celtics 112, Heat 104 → Celtics -5.5 covers (P5 Fiona wins, P4 Ethan loses)
      event: events[5],
      winner_bet_option_ids: [opt(5, 'Celtics -5.5').id],
      result_display: 'Celtics 112, Heat 104',
      home_score: 104, away_score: 112,
    },
    {
      // E6 Yankees @ Red Sox: Yankees Win (P3 Diana wins, P2 Charlie loses)
      event: events[6],
      winner_bet_option_ids: [opt(6, 'Yankees Win').id],
      result_display: 'Yankees 8, Red Sox 3',
      home_score: 3, away_score: 8,
    },
  ]

  for (const r of batch1Results) {
    await ok(`  result: ${r.result_display}`,
      await db.from('results').insert({
        event_id:               r.event.id,
        winner_bet_option_ids:  r.winner_bet_option_ids,
        result_display:         r.result_display,
        home_score:             r.home_score,
        away_score:             r.away_score,
        updated_at:             BATCH1_TS,
      }).select().single()
    )
  }

  console.log('\nCreating draft results (batch 2)...')

  const batch2Results = [
    {
      // E3 Wimbledon: Carlos Alcaraz wins (P4 Ethan wins)
      event: events[3],
      winner_bet_option_ids: [opt(3, 'Carlos Alcaraz').id],
      result_display: 'Carlos Alcaraz wins Wimbledon Men\'s Final',
      home_score: null, away_score: null,
    },
    {
      // E4 Stanley Cup MVP: Connor McDavid wins (P0 Aaron wins)
      event: events[4],
      winner_bet_option_ids: [opt(4, 'Connor McDavid').id],
      result_display: 'Connor McDavid wins the Conn Smythe Trophy',
      home_score: null, away_score: null,
    },
    {
      // E7 UFC 315: Pereira wins (P1 Bob wins, P0 Aaron loses)
      event: events[7],
      winner_bet_option_ids: [opt(7, 'Pereira').id],
      result_display: 'Pereira def. Adesanya by KO in R3',
      home_score: null, away_score: null,
    },
    {
      // E8 NASCAR H2H: Hamlin wins (P0 Aaron wins, P1 Bob loses)
      event: events[8],
      winner_bet_option_ids: [opt(8, 'Hamlin').id],
      result_display: 'Hamlin finishes ahead of Logano',
      home_score: null, away_score: null,
    },
    {
      // E9 F1 Monaco: Verstappen wins H2H (P2 Charlie wins, P3 Diana loses)
      event: events[9],
      winner_bet_option_ids: [opt(9, 'Verstappen').id],
      result_display: 'Verstappen wins Monaco GP ahead of Hamilton',
      home_score: null, away_score: null,
    },
  ]

  for (const r of batch2Results) {
    await ok(`  result: ${r.result_display}`,
      await db.from('results').insert({
        event_id:               r.event.id,
        winner_bet_option_ids:  r.winner_bet_option_ids,
        result_display:         r.result_display,
        home_score:             r.home_score,
        away_score:             r.away_score,
        updated_at:             BATCH2_TS,
      }).select().single()
    )
  }

  // ── 8. Slate games (10) ───────────────────────────────────────────────────

  console.log('\nCreating slate games...')

  // spread: home team's line (negative = home favored, positive = home underdog)
  const slateGameDefs = [
    { sport_label: 'Baseball',    away_team: 'Yankees',     home_team: 'Red Sox',    start_time_et: gt(13,5),  spread:  1.5,  notes: null },
    { sport_label: 'Baseball',    away_team: 'Dodgers',     home_team: 'Giants',     start_time_et: gt(16,5),  spread: -1.5,  notes: null },
    { sport_label: 'Baseball',    away_team: 'Cubs',        home_team: 'Cardinals',  start_time_et: gt(14,20), spread: null,  notes: null },
    { sport_label: 'Baseball',    away_team: 'Braves',      home_team: 'Mets',       start_time_et: gt(13,10), spread: -1.5,  notes: null },
    { sport_label: 'Baseball',    away_team: 'Astros',      home_team: 'Rangers',    start_time_et: gt(20,5),  spread:  1.5,  notes: null },
    { sport_label: 'Basketball',  away_team: 'Celtics',     home_team: 'Heat',       start_time_et: gt(20,0),  spread: -4.5,  notes: null },
    { sport_label: 'Hockey',      away_team: 'Oilers',      home_team: 'Flames',     start_time_et: gt(19,30), spread:  1.5,  notes: null },
    { sport_label: 'Soccer',      away_team: 'Real Madrid', home_team: 'Barcelona',  start_time_et: gt(15,0),  spread: null,  notes: 'La Liga' },
    { sport_label: 'Basketball',  away_team: 'Warriors',    home_team: 'Lakers',     start_time_et: gt(22,30), spread: -3.5,  notes: null },
    { sport_label: 'Football',    away_team: 'Packers',     home_team: 'Bears',      start_time_et: gt(13,0),  spread:  2.5,  notes: null },
  ]

  const slateGames: any[] = []
  for (const g of slateGameDefs) {
    slateGames.push(await ok(`  ${g.away_team} @ ${g.home_team}`,
      await db.from('slate_games').insert({ betstravaganza_id: bzId, ...g }).select().single()
    ))
  }

  // ── 9. Slate picks (all 6 players × 10 games, ranks 1-10) ─────────────────
  // rank 10 = most confident, rank 1 = least confident

  console.log('\nCreating slate picks...')

  // [gameIdx, teamPicked, confidenceRank]
  type SlatePick = [number, 'away' | 'home', number]

  // G0 Yankees@RedSox: away(Yankees) covers (spread 1.5 → adjustedHome=score+1.5, Yankees win 8-3 → 3+1.5=4.5 < 8, away covers)
  // G1 Dodgers@Giants: away(Dodgers) wins but home(Giants) has -1.5 spread... result: Dodgers 4, Giants 6 → 6-1.5=4.5 > 4, home covers
  // G2 Cubs@Cardinals: no spread, Cardinals 5-3, home(Cardinals) wins
  // G3 Braves@Mets: Braves 7, Mets 3, spread -1.5 → 3-1.5=1.5 < 7, away(Braves) covers
  // G4 Astros@Rangers: Astros 4, Rangers 3, spread +1.5 → 3+1.5=4.5 > 4, home(Rangers) covers
  // G5 Celtics@Heat: Celtics 112, Heat 102, spread -4.5 → 102-4.5=97.5 < 112, away(Celtics) covers

  const slatePicks: Record<string, SlatePick[]> = {
    // P0 Aaron: nearly perfect on first 6
    aaron: [
      [0, 'away', 8],   // Yankees ✓
      [1, 'home', 7],   // Giants ✓
      [2, 'home', 6],   // Cardinals ✓
      [3, 'away', 9],   // Braves ✓
      [4, 'home', 5],   // Rangers ✓
      [5, 'away', 10],  // Celtics ✓
      [6, 'away', 4],   // Oilers (no result)
      [7, 'home', 3],   // Barcelona (no result)
      [8, 'home', 2],   // Lakers (no result)
      [9, 'away', 1],   // Packers (no result)
    ],
    // P1 Bob: all wrong on first 6
    bob: [
      [0, 'home', 10],  // Red Sox ✗
      [1, 'away', 9],   // Dodgers ✗
      [2, 'away', 8],   // Cubs ✗
      [3, 'home', 7],   // Mets ✗
      [4, 'away', 6],   // Astros ✗
      [5, 'home', 5],   // Heat ✗
      [6, 'home', 4],   // Flames (no result)
      [7, 'away', 3],   // Real Madrid (no result)
      [8, 'away', 2],   // Warriors (no result)
      [9, 'home', 1],   // Bears (no result)
    ],
    // P2 Charlie: 5/6 correct
    charlie: [
      [0, 'away', 5],   // Yankees ✓
      [1, 'home', 6],   // Giants ✓
      [2, 'home', 7],   // Cardinals ✓
      [3, 'away', 4],   // Braves ✓
      [4, 'home', 8],   // Rangers ✓
      [5, 'home', 3],   // Heat ✗
      [6, 'away', 9],   // Oilers (no result)
      [7, 'home', 10],  // Barcelona (no result)
      [8, 'home', 2],   // Lakers (no result)
      [9, 'away', 1],   // Packers (no result)
    ],
    // P3 Diana: 4/6 correct
    diana: [
      [0, 'home', 3],   // Red Sox ✗
      [1, 'away', 4],   // Dodgers ✗
      [2, 'home', 8],   // Cardinals ✓
      [3, 'away', 6],   // Braves ✓
      [4, 'home', 9],   // Rangers ✓
      [5, 'away', 7],   // Celtics ✓
      [6, 'home', 5],   // Flames (no result)
      [7, 'away', 10],  // Real Madrid (no result)
      [8, 'home', 2],   // Lakers (no result)
      [9, 'away', 1],   // Packers (no result)
    ],
    // P4 Ethan: 3/6 correct
    ethan: [
      [0, 'away', 9],   // Yankees ✓
      [1, 'home', 8],   // Giants ✓
      [2, 'away', 3],   // Cubs ✗
      [3, 'home', 2],   // Mets ✗
      [4, 'away', 1],   // Astros ✗
      [5, 'away', 7],   // Celtics ✓
      [6, 'away', 6],   // Oilers (no result)
      [7, 'home', 5],   // Barcelona (no result)
      [8, 'away', 4],   // Warriors (no result)
      [9, 'home', 10],  // Bears (no result)
    ],
    // P5 Fiona: 4/6 correct
    fiona: [
      [0, 'away', 6],   // Yankees ✓
      [1, 'away', 1],   // Dodgers ✗
      [2, 'home', 7],   // Cardinals ✓
      [3, 'away', 10],  // Braves ✓
      [4, 'home', 2],   // Rangers ✓
      [5, 'home', 8],   // Heat ✗
      [6, 'home', 9],   // Flames (no result)
      [7, 'home', 5],   // Barcelona (no result)
      [8, 'home', 3],   // Lakers (no result)
      [9, 'away', 4],   // Packers (no result)
    ],
  }

  const picksByPlayer = [
    [userIds[0], slatePicks.aaron],
    [userIds[1], slatePicks.bob],
    [userIds[2], slatePicks.charlie],
    [userIds[3], slatePicks.diana],
    [userIds[4], slatePicks.ethan],
    [userIds[5], slatePicks.fiona],
  ] as const

  for (const [userId, picks] of picksByPlayer) {
    for (const [gameIdx, team, rank] of picks) {
      await ok(`  slate pick ${(userId as string).slice(0,6)} G${gameIdx} ${team} r${rank}`,
        await db.from('slate_picks').insert({
          betstravaganza_id: bzId,
          user_id:           userId,
          slate_game_id:     slateGames[gameIdx].id,
          team_picked:       team,
          confidence_rank:   rank,
        }).select().single()
      )
    }
  }

  // ── 10. Slate results (6 of 10 games, 2 batches) ─────────────────────────

  console.log('\nCreating slate results (batch 1)...')

  // G0: Yankees 8, Red Sox 3 → spread 1.5 → adjustedHome = 3+1.5 = 4.5 < 8 → away (Yankees) covers
  // G1: Dodgers 4, Giants 6 → spread -1.5 → adjustedHome = 6-1.5 = 4.5 > 4 → home (Giants) covers
  // G2: Cubs 3, Cardinals 5 → no spread → home (Cardinals) wins
  const slateResultsBatch1 = [
    { gi: 0, away_score: 8,   home_score: 3,   result_display: 'Yankees 8, Red Sox 3'     },
    { gi: 1, away_score: 4,   home_score: 6,   result_display: 'Dodgers 4, Giants 6'       },
    { gi: 2, away_score: 3,   home_score: 5,   result_display: 'Cubs 3, Cardinals 5'       },
  ]

  for (const r of slateResultsBatch1) {
    await ok(`  slate result: ${r.result_display}`,
      await db.from('slate_results').insert({
        slate_game_id:  slateGames[r.gi].id,
        away_score:     r.away_score,
        home_score:     r.home_score,
        result_display: r.result_display,
        updated_at:     BATCH1_TS,
      }).select().single()
    )
  }

  console.log('\nCreating slate results (batch 2)...')

  // G3: Braves 7, Mets 3 → spread -1.5 → adjustedHome = 3-1.5 = 1.5 < 7 → away (Braves) covers
  // G4: Astros 4, Rangers 3 → spread +1.5 → adjustedHome = 3+1.5 = 4.5 > 4 → home (Rangers) covers
  // G5: Celtics 112, Heat 102 → spread -4.5 → adjustedHome = 102-4.5 = 97.5 < 112 → away (Celtics) covers
  const slateResultsBatch2 = [
    { gi: 3, away_score: 7,   home_score: 3,   result_display: 'Braves 7, Mets 3'          },
    { gi: 4, away_score: 4,   home_score: 3,   result_display: 'Astros 4, Rangers 3'        },
    { gi: 5, away_score: 112, home_score: 102, result_display: 'Celtics 112, Heat 102'      },
  ]

  for (const r of slateResultsBatch2) {
    await ok(`  slate result: ${r.result_display}`,
      await db.from('slate_results').insert({
        slate_game_id:  slateGames[r.gi].id,
        away_score:     r.away_score,
        home_score:     r.home_score,
        result_display: r.result_display,
        updated_at:     BATCH2_TS,
      }).select().single()
    )
  }

  // ── 11. Bonuses ───────────────────────────────────────────────────────────

  console.log('\nCreating bonuses...')

  await ok('bonus: Aaron — Trivia Night winner',
    await db.from('bonuses').insert({
      betstravaganza_id: bzId,
      user_id:           userIds[0],
      title:             'Trivia Night Winner',
      amount:            50,
    }).select().single()
  )

  await ok('bonus: Charlie — First blood pick',
    await db.from('bonuses').insert({
      betstravaganza_id: bzId,
      user_id:           userIds[2],
      title:             'First Blood Pick',
      amount:            75,
    }).select().single()
  )

  // ── Done ──────────────────────────────────────────────────────────────────

  console.log('\n✅  QA seed complete!')
  console.log(`\n   Betstravaganza ID: ${bzId}`)
  console.log('\n   Players:')
  const playerSummaries = [
    { email: adminEmail, team: adminProfile?.team_name ?? "Aaron's Team", role: 'admin' },
    ...testPlayers.map(p => ({ email: p.email, team: p.team, role: 'player' })),
  ]
  for (const p of playerSummaries) {
    console.log(`     ${p.email.padEnd(26)} ${p.team.padEnd(16)} [${p.role}]  password: ${p.role === 'admin' ? '(existing)' : 'Password123!'}`)
  }
  console.log('\n   Draft:    11 rounds × 6 players = 66 picks (COMPLETE)')
  console.log('   Events:   5 required + 8 H2H optional + 7 multi optional = 20 total')
  console.log('   Results:  10 draft (5 batch1 + 5 batch2), 6 slate (3+3)')
  console.log('   Bonuses:  Aaron +$50, Charlie +$75')
  console.log('\n   Expected totals (approx, pending picks excluded):')
  console.log('     1. Charlie  ~$1236  (Tatum win + strong slate)')
  console.log('     2. Aaron    ~$1072  (McDavid win + Hamlin + trivia bonus + strong slate)')
  console.log('     3. Fiona    ~$949   (Scheffler + Celtics cover + bonus)')
  console.log('     4. Diana    ~$947   (Blaze Runner + Yankees cover)')
  console.log('     5. Ethan    ~$772   (Alcaraz win only win)')
  console.log('     6. Bob      ~$500   (Pereira win only win, no slate)')
}

run().catch(err => { console.error('\n❌', err.message ?? err); process.exit(1) })
