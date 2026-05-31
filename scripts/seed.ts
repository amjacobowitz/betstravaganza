/**
 * Seed the database with the admin user + 2 test players, a betstravaganza in
 * 'draft' state, events with bet options, slate games, and slate picks.
 *
 * Player 1 is the admin (NEXT_PUBLIC_INITIAL_ADMIN_EMAIL) — their existing auth
 * account is reused and their profile is kept intact (team_name defaults to
 * "Aaron's Team" only if unset).
 * Players 2–3 are test accounts (bob@example.com, charlie@example.com).
 *
 * Usage:
 *   npm run db:seed
 *
 * Env required (reads from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
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

  const adminEmail = process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
  if (!adminEmail) {
    console.error('❌  Missing NEXT_PUBLIC_INITIAL_ADMIN_EMAIL in .env.local')
    process.exit(1)
  }

  // ── 1. Resolve admin user + create 2 test accounts ─────────────────────

  const testPlayers = [
    { email: 'bob@example.com',     password: 'Password123!', name: 'Bob Martinez',  team: 'Chaos Theory' },
    { email: 'charlie@example.com', password: 'Password123!', name: 'Charlie Kim',   team: 'Lucky Sevens' },
  ]

  console.log('Resolving users...')
  const { data: authList } = await admin.auth.admin.listUsers()

  // Admin user (player 0) — reuse existing or create for dev
  let adminAuthUser = authList?.users.find(u => u.email === adminEmail)
  if (!adminAuthUser) {
    console.log(`  ⚠  Admin user ${adminEmail} not found — creating for dev (password: DevAdmin123!)`)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail, password: 'DevAdmin123!', email_confirm: true,
    })
    if (createErr) { console.error(`  ❌  Cannot create admin user: ${createErr.message}`); process.exit(1) }
    adminAuthUser = created.user!
  }
  const adminId = adminAuthUser.id
  console.log(`  ✓  admin ${adminEmail}`)

  // Ensure admin has a users profile with a team_name
  const { data: adminProfile } = await admin.from('users').select('*').eq('id', adminId).maybeSingle()
  await ok(`profile ${adminEmail}`, await admin.from('users').upsert({
    id:        adminId,
    email:     adminEmail,
    name:      adminProfile?.name ?? 'Aaron',
    team_name: adminProfile?.team_name ?? "Aaron's Team",
    is_admin:  true,
  }, { onConflict: 'id' }).select().single())

  // Create / find test players
  const userIds: string[] = [adminId]
  const players = [
    { email: adminEmail, name: adminProfile?.name ?? 'Aaron', team: adminProfile?.team_name ?? "Aaron's Team" },
    ...testPlayers.map(p => ({ email: p.email, name: p.name, team: p.team })),
  ]

  for (const p of testPlayers) {
    const existing = authList?.users.find(u => u.email === p.email)
    if (existing) {
      userIds.push(existing.id)
      console.log(`  ↩  auth user ${p.email} already exists`)
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: p.email, password: p.password, email_confirm: true,
      })
      if (error) { console.error(`  ❌  auth user ${p.email}: ${error.message}`); process.exit(1) }
      userIds.push(data!.user!.id)
      console.log(`  ✓  auth user ${p.email}`)
    }
  }

  // ── 2. Upsert public.users profiles ────────────────────────────────────

  console.log('\nUpserting user profiles...')
  for (let i = 1; i < players.length; i++) {
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
    round_count:           6,   // 2 required + 4 optional picks per player
    stake_amount:          100,
    starting_bankroll:     600,
    confidence_multiplier: 3,
    draft_order:           userIds,
    current_round:         1,
    current_pick_index:    12,  // rounds 1-4 are pre-filled; rounds 5-6 are live
    start_datetime:        BZ_START,
    end_datetime:          BZ_END,
  }).select().single())

  const bzId = (bz as any).id as string

  // ── 4. Events ───────────────────────────────────────────────────────────
  // 2 required: Kentucky Derby, US Open Golf
  // 4 optional (all head-to-head → CLASHes):
  //   NBA Finals, Yankees @ Red Sox, Strikeout Props, Tennis Final

  console.log('\nCreating events...')

  const eventDefs = [
    // ── required ──────────────────────────────────────────────────────────
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
      name: 'US Open Golf',
      sport: 'Golf',
      category: 'required',
      bet_type: 'odds',
      start_time_et: gameTime(14, 0),
      streaming_info: 'Peacock / NBC',
      notes: null,
    },
    // ── optional (head-to-head — CLASH candidates) ────────────────────────
    {
      name: 'NBA Finals Game 3',
      sport: 'Basketball',
      category: 'optional',
      bet_type: 'spread',
      start_time_et: gameTime(20, 0),
      streaming_info: 'ABC',
      notes: null,
    },
    {
      name: 'Yankees @ Red Sox',
      sport: 'Baseball',
      category: 'optional',
      bet_type: 'odds',
      start_time_et: gameTime(13, 5),
      streaming_info: 'ESPN',
      notes: null,
    },
    {
      name: 'Strikeout Props',
      sport: 'Baseball',
      category: 'optional',
      bet_type: 'odds',
      start_time_et: gameTime(13, 5),
      streaming_info: null,
      notes: 'Total Ks by both starting pitchers combined',
    },
    {
      name: 'French Open Women\'s Final',
      sport: 'Tennis',
      category: 'optional',
      bet_type: 'no_odds',
      start_time_et: gameTime(10, 0),
      streaming_info: 'NBC Sports',
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
  // Required events: max_drafts=1 (each horse/golfer can only be drafted once)
  // Optional events: max_drafts=2 (both sides can be drafted, enabling CLASHes)

  console.log('\nCreating bet options...')

  const betOptionDefs: { eventIdx: number; options: { label: string; odds: number | null; max_drafts?: number }[] }[] = [
    {
      eventIdx: 0, // Kentucky Derby — required, max_drafts=1 per horse
      options: [
        { label: 'Firestorm',    odds: 450  },
        { label: 'Desert Wind',  odds: 280  },
        { label: 'Lucky Luna',   odds: 600  },
        { label: 'Blaze Runner', odds: 180  },
        { label: 'Silver Arrow', odds: 1200 },
        { label: 'Thunder Bolt', odds: 320  },
      ],
    },
    {
      eventIdx: 1, // US Open Golf — required, max_drafts=1 per golfer
      options: [
        { label: 'Scottie Scheffler', odds: -120 },
        { label: 'Rory McIlroy',      odds:  200 },
        { label: 'Xander Schauffele', odds:  350 },
        { label: 'Jon Rahm',          odds:  500 },
      ],
    },
    {
      eventIdx: 2, // NBA Finals — optional, max_drafts=2 (both sides draftable)
      options: [
        { label: 'Celtics -5.5', odds: -110, max_drafts: 2 },
        { label: 'Heat +5.5',    odds: -110, max_drafts: 2 },
      ],
    },
    {
      eventIdx: 3, // Yankees @ Red Sox — optional, max_drafts=2
      options: [
        { label: 'Yankees Win', odds: -130, max_drafts: 2 },
        { label: 'Red Sox Win', odds:  110, max_drafts: 2 },
      ],
    },
    {
      eventIdx: 4, // Strikeout Props — optional, max_drafts=2
      options: [
        { label: 'Over 14.5 Ks',  odds: -115, max_drafts: 2 },
        { label: 'Under 14.5 Ks', odds: -105, max_drafts: 2 },
      ],
    },
    {
      eventIdx: 5, // French Open — optional, no_odds, max_drafts=2
      options: [
        { label: 'Iga Swiatek',    odds: null, max_drafts: 2 },
        { label: 'Aryna Sabalenka', odds: null, max_drafts: 2 },
      ],
    },
  ]

  const allOptions: any[] = []
  for (const def of betOptionDefs) {
    for (const opt of def.options) {
      const o = await ok(`  option: ${opt.label}`, await admin.from('bet_options').insert({
        event_id:    events[def.eventIdx].id,
        label:       opt.label,
        odds:        opt.odds,
        max_drafts:  opt.max_drafts ?? 1,
        odds_source: 'manual',
      }).select().single())
      allOptions.push({ ...(o as any), eventIdx: def.eventIdx })
    }
  }

  // ── 6. Draft picks ──────────────────────────────────────────────────────
  // 6 rounds, 3 players, snake draft — rounds 1-4 pre-filled (idx 0-11)
  // current_pick_index=12, so R5 (Aaron) is next on the clock
  //
  // Snake order:
  //   R1 fwd (0,1,2):  Aaron, Bob, Charlie
  //   R2 rev (3,4,5):  Charlie, Bob, Aaron
  //   R3 fwd (6,7,8):  Aaron, Bob, Charlie
  //   R4 rev (9,10,11): Charlie, Bob, Aaron
  //   R5 fwd (12,13,14): Aaron, Bob, Charlie  ← not seeded; draft live from here
  //   R6 rev (15,16,17): Charlie, Bob, Aaron   ← not seeded
  //
  // CLASHes built into seeded picks:
  //   • NBA Finals: Aaron (Celtics) vs Bob (Heat)
  //   • Yankees@RedSox: Aaron (Yankees) vs Charlie (Red Sox)
  //   • Yankees@RedSox: Bob (Yankees) vs Charlie (Red Sox)

  console.log('\nCreating draft picks (rounds 1-4)...')

  function optionsFor(eventIdx: number) {
    return allOptions.filter((o: any) => o.eventIdx === eventIdx)
  }

  function opt(eventIdx: number, label: string) {
    const o = optionsFor(eventIdx).find((o: any) => o.label === label)
    if (!o) throw new Error(`Option not found: [event ${eventIdx}] "${label}"`)
    return o
  }

  const draftPicks = [
    // R1 fwd: Aaron→Derby, Bob→Derby, Charlie→Derby
    { userId: userIds[0], option: opt(0, 'Firestorm'),    round: 1, idx: 0  },
    { userId: userIds[1], option: opt(0, 'Desert Wind'),  round: 1, idx: 1  },
    { userId: userIds[2], option: opt(0, 'Blaze Runner'), round: 1, idx: 2  },
    // R2 rev: Charlie→Golf, Bob→Golf, Aaron→Golf
    { userId: userIds[2], option: opt(1, 'Xander Schauffele'), round: 2, idx: 3  },
    { userId: userIds[1], option: opt(1, 'Rory McIlroy'),      round: 2, idx: 4  },
    { userId: userIds[0], option: opt(1, 'Scottie Scheffler'), round: 2, idx: 5  },
    // R3 fwd: Aaron→NBA Celtics, Bob→NBA Heat [CLASH!], Charlie→Red Sox Win
    { userId: userIds[0], option: opt(2, 'Celtics -5.5'), round: 3, idx: 6  },
    { userId: userIds[1], option: opt(2, 'Heat +5.5'),    round: 3, idx: 7  },
    { userId: userIds[2], option: opt(3, 'Red Sox Win'),  round: 3, idx: 8  },
    // R4 rev: Charlie→Strikeout Over, Bob→Yankees Win [CLASH!], Aaron→Yankees Win [CLASH!]
    { userId: userIds[2], option: opt(4, 'Over 14.5 Ks'), round: 4, idx: 9  },
    { userId: userIds[1], option: opt(3, 'Yankees Win'),  round: 4, idx: 10 },
    { userId: userIds[0], option: opt(3, 'Yankees Win'),  round: 4, idx: 11 },
  ]

  for (const dp of draftPicks) {
    await ok(`  draft pick [r${dp.round}] user ${dp.userId.slice(0,8)} → ${(dp.option as any).label}`,
      await admin.from('draft_picks').insert({
        betstravaganza_id: bzId,
        user_id:           dp.userId,
        bet_option_id:     (dp.option as any).id,
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
  // Each player picks all 5 games (rank 5 = most confident, 1 = least)

  console.log('\nCreating slate picks...')

  const adminSlatePicks = [
    { gameIdx: 0, team: 'away', rank: 5 }, // Yankees (most confident)
    { gameIdx: 1, team: 'away', rank: 4 }, // Dodgers
    { gameIdx: 2, team: 'home', rank: 3 }, // Cardinals
    { gameIdx: 3, team: 'away', rank: 2 }, // Braves
    { gameIdx: 4, team: 'home', rank: 1 }, // Rangers (least confident)
  ]
  const bobSlatePicks = [
    { gameIdx: 0, team: 'home', rank: 5 }, // Red Sox (CLASH with admin)
    { gameIdx: 1, team: 'away', rank: 4 }, // Dodgers
    { gameIdx: 2, team: 'away', rank: 3 }, // Cubs
    { gameIdx: 3, team: 'home', rank: 2 }, // Mets (CLASH with admin)
    { gameIdx: 4, team: 'away', rank: 1 }, // Astros
  ]
  const charlieSlatePicks = [
    { gameIdx: 0, team: 'away', rank: 3 }, // Yankees
    { gameIdx: 1, team: 'home', rank: 5 }, // Giants (CLASH with admin/Bob)
    { gameIdx: 2, team: 'home', rank: 4 }, // Cardinals
    { gameIdx: 3, team: 'away', rank: 2 }, // Braves
    { gameIdx: 4, team: 'home', rank: 1 }, // Rangers
  ]

  async function insertSlatePicks(userId: string, picks: typeof adminSlatePicks) {
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

  await insertSlatePicks(userIds[0], adminSlatePicks)
  await insertSlatePicks(userIds[1], bobSlatePicks)
  await insertSlatePicks(userIds[2], charlieSlatePicks)

  console.log('\n✅  Seed complete!')
  console.log(`\n   Betstravaganza ID: ${bzId}`)
  console.log('   Players:')
  console.log(`     ${adminEmail}  (admin, existing account)  —  ${players[0].team}`)
  for (let i = 1; i < testPlayers.length + 1; i++) {
    console.log(`     ${players[i].email}  /  Password123!  —  ${players[i].team}`)
  }
}

run().catch(err => { console.error('\n❌ ', err.message ?? err); process.exit(1) })
