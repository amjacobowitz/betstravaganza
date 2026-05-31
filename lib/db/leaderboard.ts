import { createClient } from '@/lib/supabase/server'
import {
  computePlayerBankroll,
  computeConfidenceBonus,
  isClashPick,
  type DraftPick,
  type BetOption,
  type ScoringEvent,
  type EventResult,
  type SlatePick,
  type SlateResult,
} from '@/lib/scoring'

export interface LeaderboardEntry {
  userId: string
  name: string
  teamName: string
  bankroll: number
  confidenceBonus: number
  total: number
  pendingPicks: number
  wins: number
  losses: number
  pushes: number
}

export async function getLeaderboard(betstravaganzaId: string): Promise<LeaderboardEntry[]> {
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
  ] = await Promise.all([
    supabase.from('betstravaganza').select('starting_bankroll, stake_amount, confidence_multiplier').eq('id', betstravaganzaId).single(),
    supabase.from('users').select('id, name, team_name'),
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('bet_options').select('*'),
    supabase.from('events').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('results').select('*'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('slate_results').select('*'),
  ])

  if (!usersData || !bzData) return []

  const startingBankroll = Number(bzData.starting_bankroll)
  const stake = Number(bzData.stake_amount)
  const confidenceMultiplier = Number(bzData.confidence_multiplier)

  // Raw DB rows — use any[] to avoid collisions with scoring camelCase types
  const rawPicks   = (picksData ?? []) as any[]
  const rawOptions = (optionsData ?? []) as any[]
  const rawEvents  = (eventsData ?? []) as any[]
  const rawResults = (resultsData ?? []) as any[]
  const rawSResults = (slateResultsData ?? []) as any[]

  // Build shared scoring objects once (outside per-user loop)
  const scoringOptions: BetOption[] = rawOptions.map((o: any) => ({
    id: o.id,
    eventId: o.event_id,
    label: o.label,
    odds: o.odds ? Number(o.odds) : null,
    maxDrafts: o.max_drafts,
    draftCount: 0,
  }))

  const scoringEvents: ScoringEvent[] = rawEvents.map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category as 'required' | 'optional',
    betType: e.bet_type as 'odds' | 'spread' | 'no_odds',
  }))

  const scoringResults: EventResult[] = rawResults.map((r: any) => ({
    id: r.id,
    eventId: r.event_id,
    winnerBetOptionId: r.winner_bet_option_id ?? null,
    homeScore: r.home_score ? Number(r.home_score) : null,
    awayScore: r.away_score ? Number(r.away_score) : null,
    resultDisplay: r.result_display ?? '',
  }))

  const sResults: SlateResult[] = rawSResults.map((r: any) => ({
    id: r.id,
    slateGameId: r.slate_game_id,
    homeScore: Number(r.home_score),
    awayScore: Number(r.away_score),
    resultDisplay: r.result_display ?? '',
  }))

  return usersData.map(user => {
    const userRawPicks = rawPicks.filter((p: any) => p.user_id === user.id)

    const scoringPicks: DraftPick[] = userRawPicks.map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      betOptionId: p.bet_option_id,
      eventId: scoringOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
      roundNumber: p.round_number,
      createdAt: new Date(p.created_at),
    }))

    const bankrollResult = computePlayerBankroll({
      picks: scoringPicks,
      betOptions: scoringOptions,
      events: scoringEvents,
      results: scoringResults,
      startingBankroll,
      stake,
    })

    const userSlatePicks: SlatePick[] = ((slatePicksData ?? []) as any[])
      .filter(p => p.user_id === user.id)
      .map(p => ({
        id: p.id,
        userId: p.user_id,
        slateGameId: p.slate_game_id,
        teamPicked: p.team_picked,
        confidenceRank: p.confidence_rank,
        submittedAt: new Date(p.submitted_at),
      }))

    const confidenceBonus = computeConfidenceBonus(userSlatePicks, sResults)

    const wins   = bankrollResult.picks.filter(p => p.outcome === 'win').length
    const losses = bankrollResult.picks.filter(p => p.outcome === 'loss').length
    const pushes = bankrollResult.picks.filter(p => p.outcome === 'push').length

    return {
      userId: user.id,
      name: user.name,
      teamName: user.team_name,
      bankroll: bankrollResult.total,
      confidenceBonus,
      total: bankrollResult.total + confidenceBonus,
      pendingPicks: bankrollResult.pending,
      wins,
      losses,
      pushes,
    }
  }).sort((a, b) => b.total - a.total)
}
