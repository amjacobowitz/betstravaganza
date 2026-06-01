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

export interface LeaderboardEntry {
  userId: string
  name: string
  teamName: string
  bankroll: number
  confidenceBonus: number
  bonuses: number
  total: number
  pendingPicks: number
  wins: number
  losses: number
  pushes: number
  // null = no previous data (first batch ever entered)
  rankChange: number | null
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
    { data: bonusesData },
  ] = await Promise.all([
    supabase.from('betstravaganza').select('starting_bankroll, stake_amount, confidence_multiplier').eq('id', betstravaganzaId).single(),
    supabase.from('users').select('id, name, team_name'),
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('bet_options').select('*'),
    supabase.from('events').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('results').select('*'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', betstravaganzaId),
    supabase.from('slate_results').select('*, slate_games(spread)'),
    supabase.from('bonuses').select('*').eq('betstravaganza_id', betstravaganzaId),
  ])

  if (!usersData || !bzData) return []

  const startingBankroll = Number(bzData.starting_bankroll)
  const stake = Number(bzData.stake_amount)
  const confidenceMultiplier = Number(bzData.confidence_multiplier)

  const rawPicks    = (picksData ?? []) as any[]
  const rawOptions  = (optionsData ?? []) as any[]
  const rawEvents   = (eventsData ?? []) as any[]
  const rawResults  = (resultsData ?? []) as any[]
  const rawSResults = (slateResultsData ?? []) as any[]
  const rawBonuses  = (bonusesData ?? []) as any[]

  const bonusByUser: Record<string, number> = {}
  for (const b of rawBonuses) {
    bonusByUser[b.user_id] = (bonusByUser[b.user_id] ?? 0) + Number(b.amount)
  }

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
    winnerBetOptionIds: r.winner_bet_option_ids ?? [],
    homeScore: r.home_score ? Number(r.home_score) : null,
    awayScore: r.away_score ? Number(r.away_score) : null,
    resultDisplay: r.result_display ?? '',
  }))

  const sResults: SlateResult[] = rawSResults.map((r: any) => ({
    id: r.id,
    slateGameId: r.slate_game_id,
    homeScore: Number(r.home_score),
    awayScore: Number(r.away_score),
    spread: r.slate_games?.spread != null ? Number(r.slate_games.spread) : null,
    resultDisplay: r.result_display ?? '',
  }))

  // Helper: build SlatePick[] for one user
  function userSlatePicks(userId: string): SlatePick[] {
    return ((slatePicksData ?? []) as any[])
      .filter(p => p.user_id === userId)
      .map(p => ({
        id: p.id,
        userId: p.user_id,
        slateGameId: p.slate_game_id,
        teamPicked: p.team_picked,
        confidenceRank: p.confidence_rank,
        submittedAt: new Date(p.submitted_at),
      }))
  }

  // Helper: build DraftPick[] for one user
  function userDraftPicks(userId: string): DraftPick[] {
    return rawPicks
      .filter((p: any) => p.user_id === userId)
      .map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        betOptionId: p.bet_option_id,
        eventId: scoringOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
        roundNumber: p.round_number,
        createdAt: new Date(p.created_at),
      }))
  }

  // Build current entries
  const rawEntries = usersData.map(user => {
    const picks = userDraftPicks(user.id)
    const br = computePlayerBankroll({
      picks,
      betOptions: scoringOptions,
      events: scoringEvents,
      results: scoringResults,
      startingBankroll,
      stake,
    })
    const cb = computeConfidenceBonus(userSlatePicks(user.id), sResults)
    const bonuses = bonusByUser[user.id] ?? 0
    return {
      userId: user.id,
      name: user.name,
      teamName: user.team_name,
      bankroll: br.total,
      confidenceBonus: cb,
      bonuses,
      total: br.total + cb + bonuses,
      pendingPicks: br.pending,
      wins: br.picks.filter(p => p.outcome === 'win').length,
      losses: br.picks.filter(p => p.outcome === 'loss').length,
      pushes: br.picks.filter(p => p.outcome === 'push').length,
    }
  })

  rawEntries.sort((a, b) => b.total - a.total)
  const currentRankMap: Record<string, number> = {}
  rawEntries.forEach((e, i) => { currentRankMap[e.userId] = i + 1 })

  // Compute previous rankings: exclude the most recently entered result batch
  // (all results entered within 2 min of the latest updated_at)
  const allUpdatedAts = [
    ...rawResults.map((r: any) => new Date(r.updated_at).getTime()),
    ...rawSResults.map((r: any) => new Date(r.updated_at).getTime()),
  ]
  const maxUpdatedAt = allUpdatedAts.length > 0 ? Math.max(...allUpdatedAts) : null

  let previousRankMap: Record<string, number> = {}

  if (maxUpdatedAt) {
    const batchCutoff = new Date(maxUpdatedAt - 2 * 60 * 1000)

    const prevScoringResults: EventResult[] = rawResults
      .filter((r: any) => new Date(r.updated_at) < batchCutoff)
      .map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        winnerBetOptionId: r.winner_bet_option_id ?? null,
        winnerBetOptionIds: r.winner_bet_option_ids ?? [],
        homeScore: r.home_score ? Number(r.home_score) : null,
        awayScore: r.away_score ? Number(r.away_score) : null,
        resultDisplay: r.result_display ?? '',
      }))

    const prevSResults: SlateResult[] = rawSResults
      .filter((r: any) => new Date(r.updated_at) < batchCutoff)
      .map((r: any) => ({
        id: r.id,
        slateGameId: r.slate_game_id,
        homeScore: Number(r.home_score),
        awayScore: Number(r.away_score),
        spread: r.slate_games?.spread != null ? Number(r.slate_games.spread) : null,
        resultDisplay: r.result_display ?? '',
      }))

    if (prevScoringResults.length > 0 || prevSResults.length > 0) {
      const prevEntries = usersData.map(user => {
        const picks = userDraftPicks(user.id)
        const br = computePlayerBankroll({
          picks,
          betOptions: scoringOptions,
          events: scoringEvents,
          results: prevScoringResults,
          startingBankroll,
          stake,
        })
        const cb = computeConfidenceBonus(userSlatePicks(user.id), prevSResults)
        const bonuses = bonusByUser[user.id] ?? 0
        return { userId: user.id, total: br.total + cb + bonuses }
      })
      prevEntries.sort((a, b) => b.total - a.total)
      prevEntries.forEach((e, i) => { previousRankMap[e.userId] = i + 1 })
    }
  }

  return rawEntries.map(entry => ({
    ...entry,
    rankChange: previousRankMap[entry.userId] != null
      ? previousRankMap[entry.userId] - currentRankMap[entry.userId]
      : null,
  }))
}
