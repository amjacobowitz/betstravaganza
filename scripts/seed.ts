/**
 * Seed the database with 3 test players, a betstravaganza in 'draft' state,
 * events with bet options, slate games, and slate picks for each player.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Env required (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *
 * Note: run `npm run db:clear` first if you want a clean slate.
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

if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── helpers ────────────────────────────────────────────────────────────────

async function ok<T>(label: string, res: { data: T | null; error: any }): Promise<T> {
  if (res.error) {
    console.error(`  ❌  ${label}: ${res.error.message}`)
    process.exit(1)
  }
  console.log(`  ✓  ${label}`)
  return res.data as T
}

// ISO for a game time on the event day (in ET, stored as UTC)
function gameTime(hour: number, minute = 0): string {
  // "2026-06-06 HH:MM ET" → UTC offset varies by DST; in June EDT = UTC-4
  const d = new Date(`2026-06-06T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00-04:00`)
  return d.toISOString()
}

// Betstravaganza event start: June 6 at 1:00 PM ET
const BZ_START = new Date('2026-06-06T13:00:00-04:00').toISOString()
// Betstravaganza end: June 6 at 11:00 PM ET
const BZ_END   = new Date('2026-06-06T23:00:00-04:00').toISOString()

// ─── run ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n📦  Seeding database...\n')

  // ── 1. Create 3 auth users ──────────────────────────────────────────────

  const players = [
    { email: 'alice@example.com',   password: 'Password123!', name: 'Alice Chen',    team: 'The Underdogs' },
    { email: 'bob@example.com',     password: 'Password123!', name: 'Bob Martinez',  team: 'Chaos Theory'  },
    { email: 'charlie@example.com', password: 'Password123!', name: 'Charlie Kim',   team: 'Lucky Sevens'  },
  ]

  const userIds: string[] = []
  console.log('Creating auth users...')
  for (const p of players) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
    })
    if (error && !error.message.includes('already been registered')) {
      console.error(`  ❌  auth user ${p.email}: ${error.message}`)
      process.exit(1)
    }
    const uid = data?.user?.id
    if (!uid) {
      // User already exists — look them up
      const { data: list } = await admin.auth.admin.listUsers()
      const existing = list?.users.find(u => u.email === p.email)
      if (!existing) { console.error(`  ❌  Cannot find user ${p.email}`); process.exit(1) }
      userIds.push(existing.id)
      console.log(`  ↩  auth user ${p.email} already exists`)
    } else {
      userIds.push(uid)
      console.log(`  ✓  auth user ${p.email}`)
    }
  }

  // ── 2. Upsert public.users profiles ────────────────────────────────────

  console.log('\nUpserting user profiles...')
  for (let i = 0; i < players.length; i++) {
    await ok(`profile ${players[i].email}`, await admin.from('users').upsert({
      id:        userIds[i],
      email:     players[i].email,
      name:      players[i].name,
      team_name: players[i].team,
      is_admin:  false,
    }, { onConflict: 'id' }).select().single())
  }

  // ── 3. Create betstravaganza ────────────────────────────────────────────

  console.log('\nCreating betstravaganza...')
  const bz = await ok('betstravaganza', await admin.from('betstravaganza').insert({
    name:                  'Betstravaganza 2026',
    status:                'draft',
    player_count:          3,
    round_count:           3,
    stake_amount:          100,
    starting_bankroll:     300,
    confidence_multiplier: 3,
    draft_order:           userIds,
    current_round:         1,
    current_pick_index:    0,
    start_datetime:        BZ_START,
    end_datetime:          BZ_END,
  }).select().single())

  const bzId = (bz as any).id as string

  // ── 4. Events ───────────────────────────────────────────────────────────

  console.log('\nCreating events...')

  const eventDefs = [
    {
      name: 'Kentucky Derby',
      sport: 'Horse Racing',
      category: 'required',
      bet_type: 'odds',
      start_time_et: gameTime(18, 0),
      streaming_info: 'NBC Sports',
      notes: null,
    },
    {
      name: 'NBA Finals Game 3',
      sport: 'Basketball',
      category: 'required',
      bet_type: 'spread',
      start_time_et: gameTime(20, 0),
      streaming_info: 'ABC',
      notes: null,
    },
    {
      name: 'Strikeout Props',
      sport: 'Baseball',
      category: 'optional',
      bet_type: 'odds',
      start_time_et: gameTime(13, 5),
      streaming_info: null,
      notes: 'Total Ks by starting pitchers',
    },
    {
      name: 'World Cup Qualifier: USMNT vs Mexico',
      sport: 'Soccer',
      category: 'optional',
      bet_type: 'odds',
      start_time_et: gameTime(15, 0),
      streaming_info: 'Peacock',
      notes: null,
    },
    {
      name: 'US Open Women\'s Semifinal',
      sport: 'Tennis',
      category: 'optional',
      bet_type: 'no_odds',
      start_time_et: gameTime(14, 0),
      streaming_info: 'ESPN',
      notes: null,
    },
  ]

  const events: any[] = []
  for (const e of eventDefs) {
    const ev = await ok(`event: ${e.name}`, await admin.from('events').insert({
      betstravaganza_id: bzId,
      ...e,
    }).select().single())
    events.push(ev)
  }

  // ── 5. Bet options ──────────────────────────────────────────────────────

  console.log('\nCreating bet options...')

  const betOptionDefs: { eventIdx: number; options: { label: string; odds: number | null; max_drafts?: number }[] }[] = [
    {
      eventIdx: 0, // Kentucky Derby
      options: [
        { label: 'Firestorm', odds: 450 },
        { label: 'Desert Wind', odds: 280 },
        { label: 'Lucky Luna', odds: 600 },
        { label: 'Blaze Runner', odds: 180 },
        { label: 'Silver Arrow', odds: 1200 },
        { label: 'Thunder Bolt', odds: 320 },
      ],
    },
    {
      eventIdx: 1, // NBA Finals
      options: [
        { label: 'Celtics -5.5', odds: -110 },
        { label: 'Heat +5.5', odds: -110 },
      ],
    },
    {
      eventIdx: 2, // Strikeout Props
      options: [
        { label: 'Over 14.5 Ks', odds: -115 },
        { label: 'Under 14.5 Ks', odds: -105 },
      ],
    },
    {
      eventIdx: 3, // Soccer USMNT
      options: [
        { label: 'USMNT Win', odds: 200 },
        { label: 'Draw', odds: 220 },
        { label: 'Mexico Win', odds: 130 },
      ],
    },
    {
      eventIdx: 4, // Tennis — no_odds
      options: [
        { label: 'Iga Swiatek', odds: null },
        { label: 'Aryna Sabalenka', odds: null },
      ],
    },
  ]

  const allOptions: any[] = []
  for (const def of betOptionDefs) {
    for (const opt of def.options) {
      const o = await ok(`  option: ${opt.label}`, await admin.from('bet_options').insert({
        event_id:   events[def.eventIdx].id,
        label:      opt.label,
        odds:       opt.odds,
        max_drafts: opt.max_drafts ?? 1,
        odds_source: 'manual',
      }).select().single())
      allOptions.push({ ...(o as any), eventIdx: def.eventIdx })
    }
  }

  // ── 6. Draft picks ──────────────────────────────────────────────────────
  // 3 rounds, 3 players: snake draft
  // Round 1: Alice → Bob → Charlie
  // Round 2: Charlie → Bob → Alice
  // Round 3: Alice → Bob → Charlie

  console.log('\nCreating draft picks...')

  // Helper: get options for an event
  function optionsFor(eventIdx: number) {
    return allOptions.filter(o => o.eventIdx === eventIdx)
  }

  // Alice picks: Derby (Firestorm), NBA (Celtics), Soccer (USMNT)
  // Bob picks: Derby (Desert Wind), Strikeout (Over), Tennis (Swiatek)
  // Charlie picks: Derby (Blaze Runner), NBA (Heat), Soccer (Draw)

  const draftPicks = [
    // Round 1: Alice, Bob, Charlie
    { userId: userIds[0], option: optionsFor(0).find((o:any) => o.label === 'Firestorm')!,      round: 1, idx: 0 },
    { userId: userIds[1], option: optionsFor(0).find((o:any) => o.label === 'Desert Wind')!,    round: 1, idx: 1 },
    { userId: userIds[2], option: optionsFor(0).find((o:any) => o.label === 'Blaze Runner')!,   round: 1, idx: 2 },
    // Round 2: Charlie, Bob, Alice
    { userId: userIds[2], option: optionsFor(1).find((o:any) => o.label === 'Heat +5.5')!,      round: 2, idx: 3 },
    { userId: userIds[1], option: optionsFor(2).find((o:any) => o.label === 'Over 14.5 Ks')!,  round: 2, idx: 4 },
    { userId: userIds[0], option: optionsFor(1).find((o:any) => o.label === 'Celtics -5.5')!,  round: 2, idx: 5 },
    // Round 3: Alice, Bob, Charlie
    { userId: userIds[0], option: optionsFor(3).find((o:any) => o.label === 'USMNT Win')!,     round: 3, idx: 6 },
    { userId: userIds[1], option: optionsFor(4).find((o:any) => o.label === 'Iga Swiatek')!,   round: 3, idx: 7 },
    { userId: userIds[2], option: optionsFor(3).find((o:any) => o.label === 'Draw')!,          round: 3, idx: 8 },
  ]

  for (const dp of draftPicks) {
    if (!dp.option) { console.error('  ❌  Could not find bet option for draft pick'); continue }
    await ok(`  draft pick [r${dp.round}] user ${dp.userId.slice(0,8)} → ${dp.option.label}`,
      await admin.from('draft_picks').insert({
        betstravaganza_id: bzId,
        user_id:           dp.userId,
        bet_option_id:     dp.option.id,
        round_number:      dp.round,
        pick_index:        dp.idx,
      }).select().single()
    )
  }

  // ── 7. Slate games ──────────────────────────────────────────────────────

  console.log('\nCreating slate games...')

  const slateGameDefs = [
    { sport_label: 'Baseball', away_team: 'Yankees', home_team: 'Red Sox',    start_time_et: gameTime(13, 5),  spread: 1.5,  notes: 'YES/NESN' },
    { sport_label: 'Baseball', away_team: 'Dodgers', home_team: 'Giants',     start_time_et: gameTime(16, 5),  spread: -1.5, notes: null },
    { sport_label: 'Baseball', away_team: 'Cubs',    home_team: 'Cardinals',  start_time_et: gameTime(14, 20), spread: null, notes: null },
    { sport_label: 'Baseball', away_team: 'Braves',  home_team: 'Mets',       start_time_et: gameTime(13, 10), spread: -1.5, notes: null },
    { sport_label: 'Baseball', away_team: 'Astros',  home_team: 'Rangers',    start_time_et: gameTime(20, 5),  spread: 1.5,  notes: null },
  ]

  const slateGames: any[] = []
  for (const g of slateGameDefs) {
    const sg = await ok(`  game: ${g.away_team} @ ${g.home_team}`,
      await admin.from('slate_games').insert({
        betstravaganza_id: bzId,
        ...g,
      }).select().single()
    )
    slateGames.push(sg)
  }

  // ── 8. Slate picks ──────────────────────────────────────────────────────
  // Each player picks all 5 games with confidence ranks 5 (most) to 1 (least)

  console.log('\nCreating slate picks...')

  // Alice picks (rank 5 = most confident)
  const alicePicks = [
    { gameIdx: 0, team: 'away', rank: 5 }, // Yankees (most confident)
    { gameIdx: 1, team: 'away', rank: 4 }, // Dodgers
    { gameIdx: 2, team: 'home', rank: 3 }, // Cardinals
    { gameIdx: 3, team: 'away', rank: 2 }, // Braves
    { gameIdx: 4, team: 'home', rank: 1 }, // Rangers (least confident)
  ]
  // Bob picks — opposing some of Alice's to create clashes
  const bobPicks = [
    { gameIdx: 0, team: 'home', rank: 5 }, // Red Sox (CLASH with Alice)
    { gameIdx: 1, team: 'away', rank: 4 }, // Dodgers
    { gameIdx: 2, team: 'away', rank: 3 }, // Cubs
    { gameIdx: 3, team: 'home', rank: 2 }, // Mets (CLASH with Alice)
    { gameIdx: 4, team: 'away', rank: 1 }, // Astros
  ]
  // Charlie picks
  const charliePicks = [
    { gameIdx: 0, team: 'away', rank: 3 }, // Yankees
    { gameIdx: 1, team: 'home', rank: 5 }, // Giants (CLASH with Alice/Bob)
    { gameIdx: 2, team: 'home', rank: 4 }, // Cardinals
    { gameIdx: 3, team: 'away', rank: 2 }, // Braves
    { gameIdx: 4, team: 'home', rank: 1 }, // Rangers
  ]

  async function insertSlatePicks(userId: string, picks: typeof alicePicks) {
    for (const p of picks) {
      await ok(`  slate pick user ${userId.slice(0,8)} game ${p.gameIdx} → ${p.team} rank ${p.rank}`,
        await admin.from('slate_picks').insert({
          betstravaganza_id: bzId,
          user_id:           userId,
          slate_game_id:     slateGames[p.gameIdx].id,
          team_picked:       p.team,
          confidence_rank:   p.rank,
        }).select().single()
      )
    }
  }

  await insertSlatePicks(userIds[0], alicePicks)
  await insertSlatePicks(userIds[1], bobPicks)
  await insertSlatePicks(userIds[2], charliePicks)

  console.log('\n✅  Seed complete!')
  console.log(`\n   Betstravaganza ID: ${bzId}`)
  console.log('   Players:')
  for (let i = 0; i < players.length; i++) {
    console.log(`     ${players[i].email}  /  ${players[i].password}  —  ${players[i].team}`)
  }
}

run().catch(err => { console.error('\n❌ ', err.message ?? err); process.exit(1) })
