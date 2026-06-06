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

export interface ProposedEventResult {
  eventId: string
  eventName: string
  sport: string
  winnerBetOptionId: string
  winnerLabel: string
  resultDisplay: string
  bzId: string
}

export interface NotFoundEvent {
  eventId: string
  eventName: string
  sport: string
  reason: 'no_api_sport' | 'no_match' | 'not_completed' | 'not_binary'
}

export interface FetchResultsResponse {
  proposed: ProposedSlateResult[]
  proposedEvents: ProposedEventResult[]
  notFound: NotFoundSlateGame[]
  notFoundEvents: NotFoundEvent[]
  error?: string
}

function extractTeamName(label: string): string {
  return label.replace(/\s+wins?\s*$/i, '').trim()
}

function windowedGames(allGames: OddsApiGame[], refTimeIso: string | null): OddsApiGame[] {
  if (!refTimeIso) return allGames
  const refMs = new Date(refTimeIso).getTime()
  return allGames.filter(g => Math.abs(new Date(g.commence_time).getTime() - refMs) < 18 * 60 * 60 * 1000)
}

export async function fetchResultsFromAPI(bzId: string): Promise<FetchResultsResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { proposed: [], proposedEvents: [], notFound: [], notFoundEvents: [], error: 'Not authenticated' }
    const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return { proposed: [], proposedEvents: [], notFound: [], notFoundEvents: [], error: 'Not authorized' }

    const now = new Date().toISOString()

    // ── Slate games ───────────────────────────────────────────────────────────

    const { data: slateGames } = await supabase
      .from('slate_games')
      .select('id, away_team, home_team, sport_label, start_time_et')
      .eq('betstravaganza_id', bzId)
      .lt('start_time_et', now)

    const slateIds = (slateGames ?? []).map(g => g.id)
    const { data: existingSlateResults } = slateIds.length
      ? await supabase.from('slate_results').select('slate_game_id').in('slate_game_id', slateIds)
      : { data: [] as { slate_game_id: string }[] }

    const savedSlate = new Set((existingSlateResults ?? []).map(r => r.slate_game_id))
    const pendingSlate = (slateGames ?? []).filter(g => !savedSlate.has(g.id))

    // ── Draft pick events (binary win/loss only) ───────────────────────────────

    const { data: rawEvents } = await supabase
      .from('events')
      .select('id, name, sport, start_time_et, bet_options(id, label)')
      .eq('betstravaganza_id', bzId)
      .lt('start_time_et', now)

    const eventIds = (rawEvents ?? []).map((e: any) => e.id)
    const { data: existingEventResults } = eventIds.length
      ? await supabase.from('results').select('event_id').in('event_id', eventIds)
      : { data: [] as { event_id: string }[] }

    const savedEvents = new Set((existingEventResults ?? []).map((r: any) => r.event_id))

    // Only consider binary events: exactly 2 options, both labels ending in "win"/"wins"
    const pendingEvents = (rawEvents ?? []).filter((e: any) => {
      if (savedEvents.has(e.id)) return false
      const opts: any[] = e.bet_options ?? []
      if (opts.length !== 2) return false
      return opts.every((o: any) => /wins?\s*$/i.test(o.label.trim()))
    })

    // ── Fetch scores (deduplicated across slate + events) ─────────────────────

    const slateSportKeys = pendingSlate.map(g => SPORT_API_KEYS[g.sport_label]).filter(Boolean) as string[]
    const eventSportKeys = pendingEvents.map((e: any) => SPORT_API_KEYS[e.sport]).filter(Boolean) as string[]
    const allSportKeys = [...new Set([...slateSportKeys, ...eventSportKeys])]

    const scoresByKey: Record<string, OddsApiGame[]> = {}
    await Promise.allSettled(
      allSportKeys.map(async key => {
        scoresByKey[key] = await fetchScores(key)
      })
    )

    // ── Process slate games ───────────────────────────────────────────────────

    const proposed: ProposedSlateResult[] = []
    const notFound: NotFoundSlateGame[] = []

    for (const game of pendingSlate) {
      const sportKey = SPORT_API_KEYS[game.sport_label]
      if (!sportKey) {
        notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: 'no_api_sport' })
        continue
      }

      const windowed = windowedGames(scoresByKey[sportKey] ?? [], game.start_time_et)
      const completedGames = windowed.filter(g => g.completed)
      const match = matchGame(game.away_team, game.home_team, completedGames, game.start_time_et ?? undefined)

      const extractScores = (apiGame: OddsApiGame) => {
        if (!apiGame.scores) return null
        const awayScore = Number(apiGame.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.away_team)) || normalizeTeam(game.away_team).includes(normalizeTeam(s.name)))?.score ?? 0)
        const homeScore = Number(apiGame.scores.find(s => normalizeTeam(s.name).includes(normalizeTeam(game.home_team)) || normalizeTeam(game.home_team).includes(normalizeTeam(s.name)))?.score ?? 0)
        return { awayScore, homeScore }
      }

      if (!match) {
        const inProgressMatch = matchGame(game.away_team, game.home_team, windowed.filter(g => !g.completed), game.start_time_et ?? undefined)
        const liveScores = inProgressMatch ? extractScores(inProgressMatch) : null
        if (liveScores) {
          proposed.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, awayScore: liveScores.awayScore, homeScore: liveScores.homeScore, resultDisplay: `${game.away_team} ${liveScores.awayScore}, ${game.home_team} ${liveScores.homeScore}`, isCompleted: false })
        } else {
          notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: inProgressMatch ? 'not_completed' : 'no_match' })
        }
        continue
      }

      const scores = extractScores(match)
      if (!scores) {
        notFound.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, sportLabel: game.sport_label, reason: 'not_completed' })
        continue
      }

      proposed.push({ slateGameId: game.id, awayTeam: game.away_team, homeTeam: game.home_team, awayScore: scores.awayScore, homeScore: scores.homeScore, resultDisplay: `${game.away_team} ${scores.awayScore}, ${game.home_team} ${scores.homeScore}`, isCompleted: true })
    }

    // ── Process draft pick events ─────────────────────────────────────────────

    const proposedEvents: ProposedEventResult[] = []
    const notFoundEvents: NotFoundEvent[] = []

    for (const event of pendingEvents as any[]) {
      const sportKey = SPORT_API_KEYS[event.sport]
      if (!sportKey) {
        notFoundEvents.push({ eventId: event.id, eventName: event.name, sport: event.sport, reason: 'no_api_sport' })
        continue
      }

      const opts: { id: string; label: string }[] = event.bet_options
      const teamA = extractTeamName(opts[0].label)
      const teamB = extractTeamName(opts[1].label)

      const windowed = windowedGames(scoresByKey[sportKey] ?? [], event.start_time_et)
      const completedGames = windowed.filter(g => g.completed)

      // Match by looking for both team names in the API game (in either home/away order)
      const normA = normalizeTeam(teamA)
      const normB = normalizeTeam(teamB)
      const candidates = completedGames.filter(g => {
        const apiAway = normalizeTeam(g.away_team)
        const apiHome = normalizeTeam(g.home_team)
        const aAway = apiAway.includes(normA) || normA.includes(apiAway)
        const bHome = apiHome.includes(normB) || normB.includes(apiHome)
        const bAway = apiAway.includes(normB) || normB.includes(apiAway)
        const aHome = apiHome.includes(normA) || normA.includes(apiHome)
        return (aAway && bHome) || (bAway && aHome)
      })

      const apiGame = candidates.length === 0 ? null
        : candidates.length === 1 ? candidates[0]
        : (() => {
            const ref = new Date(event.start_time_et).getTime()
            return candidates.reduce((best: OddsApiGame, g: OddsApiGame) => {
              return Math.abs(new Date(g.commence_time).getTime() - ref) <
                     Math.abs(new Date(best.commence_time).getTime() - ref) ? g : best
            })
          })()

      if (!apiGame) {
        // Check if in-progress
        const inProgress = windowed.some(g => {
          if (g.completed) return false
          const apiAway = normalizeTeam(g.away_team)
          const apiHome = normalizeTeam(g.home_team)
          return (apiAway.includes(normA) || normA.includes(apiAway) || apiAway.includes(normB) || normB.includes(apiAway)) &&
                 (apiHome.includes(normA) || normA.includes(apiHome) || apiHome.includes(normB) || normB.includes(apiHome))
        })
        notFoundEvents.push({ eventId: event.id, eventName: event.name, sport: event.sport, reason: inProgress ? 'not_completed' : 'no_match' })
        continue
      }

      if (!apiGame.scores) {
        notFoundEvents.push({ eventId: event.id, eventName: event.name, sport: event.sport, reason: 'not_completed' })
        continue
      }

      // Determine winner by comparing scores
      const scoreA = apiGame.scores.find(s => {
        const n = normalizeTeam(s.name)
        return n.includes(normA) || normA.includes(n)
      })
      const scoreB = apiGame.scores.find(s => {
        const n = normalizeTeam(s.name)
        return n.includes(normB) || normB.includes(n)
      })

      if (!scoreA || !scoreB) {
        notFoundEvents.push({ eventId: event.id, eventName: event.name, sport: event.sport, reason: 'no_match' })
        continue
      }

      const numA = Number(scoreA.score)
      const numB = Number(scoreB.score)
      if (numA === numB) {
        // Draw — can't determine winner, surface as not_completed so admin enters manually
        notFoundEvents.push({ eventId: event.id, eventName: event.name, sport: event.sport, reason: 'not_completed' })
        continue
      }

      const winner = numA > numB ? opts[0] : opts[1]
      const loser  = numA > numB ? opts[1] : opts[0]
      const winnerTeam = numA > numB ? teamA : teamB
      const loserTeam  = numA > numB ? teamB : teamA
      const winnerScore = numA > numB ? numA : numB
      const loserScore  = numA > numB ? numB : numA

      proposedEvents.push({
        eventId: event.id,
        eventName: event.name,
        sport: event.sport,
        winnerBetOptionId: winner.id,
        winnerLabel: winner.label,
        resultDisplay: `${winnerTeam} ${winnerScore}, ${loserTeam} ${loserScore}`,
        bzId,
      })
    }

    return { proposed, proposedEvents, notFound, notFoundEvents }
  } catch (e: any) {
    return { proposed: [], proposedEvents: [], notFound: [], notFoundEvents: [], error: e.message }
  }
}
