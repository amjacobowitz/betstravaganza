import { createClient } from '@/lib/supabase/server'
import {
  computePlayerBankroll,
  computeConfidenceBonus,
  type DraftPick,
  type BetOption,
  type ScoringEvent,
  type EventResult,
  type SlatePick,
  type SlateResult,
} from '@/lib/scoring'

export interface MarketStep {
  stepIndex: number
  label: string
  type: 'draft' | 'slate'
  timestamp: number
  totals: Record<string, number>
}

export interface MarketHistoryData {
  steps: MarketStep[]
  users: Array<{ userId: string; teamName: string; name: string }>
  startingBankroll: number
}

export async function getMarketHistory(betstravaganzaId: string): Promise<MarketHistoryData> {
  const supabase = await createClient()

  const [
    { data: bzData },
    { data: usersData },
    { data: picksData },
    { data: optionsData },
    { data: eventsData },
    { data: resultsData },
    { data: slatePicksData },
    { data: slateResultsData },
    { data: bonusesData },
  ] = await Promise.all([
    supabase.from('betstravaganza').select('starting_bankroll, stake_amount').eq('id', betstravaganzaId).single(),
    supabase.from('users').select('id, name, team_name'),
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('bet_options').select('*'),
    supabase.from('events').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('results').select('*'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('slate_results').select('*, slate_games(spread, away_team, home_team)'),
    supabase.from('bonuses').select('*').eq('betstravaganza_id', betstravaganzaId),
  ])

  if (!usersData || !bzData) return { steps: [], users: [], startingBankroll: 0 }

  const startingBankroll = Number(bzData.starting_bankroll)
  const stake = Number(bzData.stake_amount)

  const rawPicks    = (picksData ?? []) as any[]
  const rawOptions  = (optionsData ?? []) as any[]
  const rawEvents   = (eventsData ?? []) as any[]
  const rawResults  = (resultsData ?? []) as any[]
  const rawSResults = (slateResultsData ?? []) as any[]
  const rawBonuses  = (bonusesData ?? []) as any[]

  const eventsById: Record<string, string> = {}
  for (const e of rawEvents) eventsById[e.id] = e.name

  const scoringOptions: BetOption[] = rawOptions.map((o: any) => ({
    id: o.id, eventId: o.event_id, label: o.label,
    odds: o.odds ? Number(o.odds) : null, maxDrafts: o.max_drafts, draftCount: 0,
  }))

  const scoringEvents: ScoringEvent[] = rawEvents.map((e: any) => ({
    id: e.id, name: e.name,
    category: e.category as 'required' | 'optional',
    betType: e.bet_type as 'odds' | 'spread' | 'no_odds',
  }))

  function userDraftPicks(userId: string): DraftPick[] {
    return rawPicks
      .filter((p: any) => p.user_id === userId)
      .map((p: any) => ({
        id: p.id, userId: p.user_id, betOptionId: p.bet_option_id,
        eventId: scoringOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
        roundNumber: p.round_number, createdAt: new Date(p.created_at),
      }))
  }

  function userSlatePicks(userId: string): SlatePick[] {
    return ((slatePicksData ?? []) as any[])
      .filter(p => p.user_id === userId)
      .map(p => ({
        id: p.id, userId: p.user_id, slateGameId: p.slate_game_id,
        teamPicked: p.team_picked, confidenceRank: p.confidence_rank,
        submittedAt: new Date(p.submitted_at),
      }))
  }

  // Each resolved result is one step; sort by timestamp then alphabetically
  const allRawSteps = [
    ...rawResults.map((r: any) => ({
      type: 'draft' as const,
      label: eventsById[r.event_id] ?? 'Unknown',
      resultId: r.id,
      timestamp: new Date(r.updated_at).getTime(),
    })),
    ...rawSResults.map((r: any) => ({
      type: 'slate' as const,
      label: `${r.slate_games?.away_team ?? '?'} @ ${r.slate_games?.home_team ?? '?'}`,
      resultId: r.id,
      timestamp: new Date(r.updated_at).getTime(),
    })),
  ]

  allRawSteps.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    if (a.type !== b.type) return a.type === 'draft' ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  const users = usersData.map((u: any) => ({ userId: u.id, teamName: u.team_name, name: u.name }))

  const startStep: MarketStep = {
    stepIndex: -1,
    label: 'Start',
    type: 'draft',
    timestamp: 0,
    totals: Object.fromEntries(usersData.map((u: any) => [u.id, startingBankroll])),
  }

  if (allRawSteps.length === 0) return { steps: [startStep], users, startingBankroll }

  const includedDraftIds = new Set<string>()
  const includedSlateIds = new Set<string>()
  const steps: MarketStep[] = []

  for (let i = 0; i < allRawSteps.length; i++) {
    const raw = allRawSteps[i]
    if (raw.type === 'draft') includedDraftIds.add(raw.resultId)
    else includedSlateIds.add(raw.resultId)

    const prevResults: EventResult[] = rawResults
      .filter((r: any) => includedDraftIds.has(r.id))
      .map((r: any) => ({
        id: r.id, eventId: r.event_id,
        winnerBetOptionId: r.winner_bet_option_id ?? null,
        winnerBetOptionIds: r.winner_bet_option_ids ?? [],
        homeScore: r.home_score ? Number(r.home_score) : null,
        awayScore: r.away_score ? Number(r.away_score) : null,
        resultDisplay: r.result_display ?? '',
      }))

    const prevSResults: SlateResult[] = rawSResults
      .filter((r: any) => includedSlateIds.has(r.id))
      .map((r: any) => ({
        id: r.id, slateGameId: r.slate_game_id,
        homeScore: Number(r.home_score), awayScore: Number(r.away_score),
        spread: r.slate_games?.spread != null ? Number(r.slate_games.spread) : null,
        resultDisplay: r.result_display ?? '',
      }))

    const prevBonusByUser: Record<string, number> = {}
    for (const b of rawBonuses.filter((b: any) => new Date(b.created_at).getTime() <= raw.timestamp)) {
      prevBonusByUser[b.user_id] = (prevBonusByUser[b.user_id] ?? 0) + Number(b.amount)
    }

    const totals: Record<string, number> = {}
    for (const user of usersData) {
      const br = computePlayerBankroll({
        picks: userDraftPicks((user as any).id),
        betOptions: scoringOptions,
        events: scoringEvents,
        results: prevResults,
        startingBankroll,
        stake,
      })
      const cb = computeConfidenceBonus(userSlatePicks((user as any).id), prevSResults)
      totals[(user as any).id] = br.total + cb + (prevBonusByUser[(user as any).id] ?? 0)
    }

    steps.push({ stepIndex: i, label: raw.label, type: raw.type, timestamp: raw.timestamp, totals })
  }

  return { steps: [startStep, ...steps], users, startingBankroll }
}
