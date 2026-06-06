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
  isCompleted: boolean
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

      // Narrow to games that started within ±18 hours of our scheduled start to avoid
      // matching a completed game from a previous day when today's game is still in progress.
      const refMs = game.start_time_et ? new Date(game.start_time_et).getTime() : null
      const windowedGames = refMs
        ? allApiGames.filter(g => Math.abs(new Date(g.commence_time).getTime() - refMs) < 18 * 60 * 60 * 1000)
        : allApiGames

      const completedApiGames = windowedGames.filter(g => g.completed)
      const match = matchGame(game.away_team, game.home_team, completedApiGames, game.start_time_et ?? undefined)

      const extractScores = (apiGame: OddsApiGame) => {
        if (!apiGame.scores) return null
        const awayScore = Number(apiGame.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.away_team)) || normalizeTeam(game.away_team).includes(normalizeTeam(s.name)))?.score ?? 0)
        const homeScore = Number(apiGame.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.home_team)) || normalizeTeam(game.home_team).includes(normalizeTeam(s.name)))?.score ?? 0)
        return { awayScore, homeScore }
      }

      if (!match) {
        // Try in-progress games — if they have live scores, surface them as overrideable proposals
        const inProgressMatch = matchGame(game.away_team, game.home_team, windowedGames.filter(g => !g.completed), game.start_time_et ?? undefined)
        const liveScores = inProgressMatch ? extractScores(inProgressMatch) : null
        if (liveScores) {
          proposed.push({
            slateGameId: game.id,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            awayScore: liveScores.awayScore,
            homeScore: liveScores.homeScore,
            resultDisplay: `${game.away_team} ${liveScores.awayScore}, ${game.home_team} ${liveScores.homeScore}`,
            isCompleted: false,
          })
        } else {
          notFound.push({
            slateGameId: game.id,
            awayTeam: game.away_team,
            homeTeam: game.home_team,
            sportLabel: game.sport_label,
            reason: inProgressMatch ? 'not_completed' : 'no_match',
          })
        }
        continue
      }

      const scores = extractScores(match)
      if (!scores) {
        notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: 'not_completed' })
        continue
      }

      proposed.push({
        slateGameId: game.id,
        awayTeam: game.away_team,
        homeTeam: game.home_team,
        awayScore: scores.awayScore,
        homeScore: scores.homeScore,
        resultDisplay: `${game.away_team} ${scores.awayScore}, ${game.home_team} ${scores.homeScore}`,
        isCompleted: true,
      })
    }

    return { proposed, notFound }
  } catch (e: any) {
    return { proposed: [], notFound: [], error: e.message }
  }
}
