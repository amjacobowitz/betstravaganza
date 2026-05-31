'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchScores } from '@/lib/odds-api/client'
import { SPORT_API_KEYS, matchGame, normalizeTeam } from '@/lib/odds-api/mapper'
import type { OddsApiGame } from '@/lib/odds-api/client'

export interface ProposedSlateResult {
  slateGameId: string
  awayTeam: string
  homeTeam: string
  awayScore: number
  homeScore: number
  resultDisplay: string
}

export interface NotFoundSlateGame {
  slateGameId: string
  awayTeam: string
  homeTeam: string
  sportLabel: string
  reason: 'no_api_sport' | 'no_match' | 'not_completed'
}

export interface FetchResultsResponse {
  proposed: ProposedSlateResult[]
  notFound: NotFoundSlateGame[]
  error?: string
}

export async function fetchResultsFromAPI(bzId: string): Promise<FetchResultsResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { proposed: [], notFound: [], error: 'Not authenticated' }
    const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return { proposed: [], notFound: [], error: 'Not authorized' }

    const now = new Date().toISOString()

    // Only consider games whose start time has passed
    const { data: slateGames } = await supabase
      .from('slate_games')
      .select('id, away_team, home_team, sport_label, start_time_et')
      .eq('betstravaganza_id', bzId)
      .lt('start_time_et', now)

    if (!slateGames?.length) return { proposed: [], notFound: [] }

    // Skip games that already have results saved
    const { data: existingResults } = await supabase
      .from('slate_results')
      .select('slate_game_id')
      .in('slate_game_id', slateGames.map(g => g.id))

    const alreadySaved = new Set((existingResults ?? []).map(r => r.slate_game_id))
    const pending = slateGames.filter(g => !alreadySaved.has(g.id))

    if (!pending.length) return { proposed: [], notFound: [] }

    // Fetch scores grouped by sport key (deduplicated)
    const sportKeys = [...new Set(
      pending.map(g => SPORT_API_KEYS[g.sport_label]).filter(Boolean) as string[]
    )]

    const scoresByKey: Record<string, OddsApiGame[]> = {}
    await Promise.allSettled(
      sportKeys.map(async key => {
        scoresByKey[key] = await fetchScores(key)
      })
    )

    const proposed: ProposedSlateResult[] = []
    const notFound: NotFoundSlateGame[] = []

    for (const game of pending) {
      const sportKey = SPORT_API_KEYS[game.sport_label]

      if (!sportKey) {
        notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: 'no_api_sport' })
        continue
      }

      const allApiGames = scoresByKey[sportKey] ?? []

      // Skip in-progress games per user request
      const completedApiGames = allApiGames.filter(g => g.completed)
      const match = matchGame(game.away_team, game.home_team, completedApiGames, game.start_time_et ?? undefined)

      if (!match) {
        // Check if it matched but wasn't completed yet
        const inProgressMatch = matchGame(game.away_team, game.home_team, allApiGames.filter(g => !g.completed), game.start_time_et ?? undefined)
        notFound.push({
          slateGameId: game.id,
          awayTeam: game.away_team,
          homeTeam: game.home_team,
          sportLabel: game.sport_label,
          reason: inProgressMatch ? 'not_completed' : 'no_match',
        })
        continue
      }

      if (!match.scores) {
        notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: 'not_completed' })
        continue
      }

      const awayScore = Number(match.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.away_team)) || normalizeTeam(game.away_team).includes(normalizeTeam(s.name)))?.score ?? 0)
      const homeScore = Number(match.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.home_team)) || normalizeTeam(game.home_team).includes(normalizeTeam(s.name)))?.score ?? 0)

      proposed.push({
        slateGameId: game.id,
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        awayScore,
        homeScore,
        resultDisplay: `${game.away_team} ${awayScore}, ${game.home_team} ${homeScore}`,
      })
    }

    return { proposed, notFound }
  } catch (e: any) {
    return { proposed: [], notFound: [], error: e.message }
  }
}
