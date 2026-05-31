'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/odds-api/client'
import { SPORT_API_KEYS, parseMatchup, findOutcomeForLabel, matchGame } from '@/lib/odds-api/mapper'
import type { OddsApiOddsGame } from '@/lib/odds-api/client'

const PREFERRED_BOOKMAKERS = ['fanduel', 'draftkings', 'betmgm', 'caesars']

// Internal helpers ─────────────────────────────────────────────────────────────

function pickMarket(game: OddsApiOddsGame, marketKey: string) {
  for (const bmKey of PREFERRED_BOOKMAKERS) {
    const bm = game.bookmakers.find(b => b.key === bmKey)
    const market = bm?.markets.find(m => m.key === marketKey)
    if (market) return market
  }
  for (const bm of game.bookmakers) {
    const market = bm.markets.find(m => m.key === marketKey)
    if (market) return market
  }
  return null
}

// Public types ─────────────────────────────────────────────────────────────────

export interface ProposedOddsUpdate {
  betOptionId: string
  optionLabel: string
  eventId: string
  eventName: string
  currentOdds: number | null
  newOdds: number
  changed: boolean
  newPoint?: number
  pointChanged?: boolean
}

export interface ProposedSpreadUpdate {
  slateGameId: string
  gameName: string
  sport: string
  currentSpread: number | null
  newSpread: number
  changed: boolean
}

export interface UnmatchedEvent {
  eventId: string
  eventName: string
  sport: string
  reason: 'no_api_sport' | 'not_a_matchup' | 'no_game_match' | 'no_odds_data'
}

export interface FetchOddsResponse {
  proposed: ProposedOddsUpdate[]
  proposedSpreads: ProposedSpreadUpdate[]
  unmatched: UnmatchedEvent[]
  error?: string
}

// Server action ────────────────────────────────────────────────────────────────

export async function fetchOddsFromAPI(bzId: string): Promise<FetchOddsResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { proposed: [], proposedSpreads: [], unmatched: [], error: 'Not authenticated' }
    const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return { proposed: [], proposedSpreads: [], unmatched: [], error: 'Not authorized' }

    const [eventsResult, slateGamesResult] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, sport, bet_type, bet_options(id, label, odds)')
        .eq('betstravaganza_id', bzId)
        .neq('bet_type', 'no_odds'),
      supabase
        .from('slate_games')
        .select('id, sport_label, away_team, home_team, start_time_et, spread')
        .eq('betstravaganza_id', bzId),
    ])

    const events = eventsResult.data ?? []
    const slateGames = slateGamesResult.data ?? []

    // Collect sport/market combos needed from all sources
    const sportMarkets: Record<string, Set<string>> = {}

    for (const ev of events) {
      const sportKey = SPORT_API_KEYS[ev.sport]
      if (!sportKey || !parseMatchup(ev.name)) continue
      const market = ev.bet_type === 'spread' ? 'spreads' : 'h2h'
      if (!sportMarkets[sportKey]) sportMarkets[sportKey] = new Set()
      sportMarkets[sportKey].add(market)
    }

    for (const game of slateGames) {
      const sportKey = SPORT_API_KEYS[game.sport_label]
      if (!sportKey) continue
      if (!sportMarkets[sportKey]) sportMarkets[sportKey] = new Set()
      sportMarkets[sportKey].add('spreads')
    }

    const oddsByKey: Record<string, OddsApiOddsGame[]> = {}
    await Promise.allSettled(
      Object.entries(sportMarkets).map(async ([key, markets]) => {
        oddsByKey[key] = await fetchOdds(key, [...markets])
      })
    )

    const proposed: ProposedOddsUpdate[] = []
    const proposedSpreads: ProposedSpreadUpdate[] = []
    const unmatched: UnmatchedEvent[] = []

    // Process draft events / bet options
    for (const ev of events) {
      const sportKey = SPORT_API_KEYS[ev.sport]
      if (!sportKey) {
        unmatched.push({ eventId: ev.id, eventName: ev.name, sport: ev.sport, reason: 'no_api_sport' })
        continue
      }

      const matchup = parseMatchup(ev.name)
      if (!matchup) {
        unmatched.push({ eventId: ev.id, eventName: ev.name, sport: ev.sport, reason: 'not_a_matchup' })
        continue
      }

      const apiGame = matchGame(matchup.away, matchup.home, oddsByKey[sportKey] ?? [])
      if (!apiGame) {
        unmatched.push({ eventId: ev.id, eventName: ev.name, sport: ev.sport, reason: 'no_game_match' })
        continue
      }

      const marketKey = ev.bet_type === 'spread' ? 'spreads' : 'h2h'
      const market = pickMarket(apiGame, marketKey)
      if (!market) {
        unmatched.push({ eventId: ev.id, eventName: ev.name, sport: ev.sport, reason: 'no_odds_data' })
        continue
      }

      for (const opt of ev.bet_options) {
        const outcome = findOutcomeForLabel(opt.label, market.outcomes)
        if (!outcome) continue

        const update: ProposedOddsUpdate = {
          betOptionId: opt.id,
          optionLabel: opt.label,
          eventId:     ev.id,
          eventName:   ev.name,
          currentOdds: opt.odds,
          newOdds:     outcome.price,
          changed:     opt.odds !== outcome.price,
        }

        if (ev.bet_type === 'spread' && outcome.point !== undefined) {
          update.newPoint = outcome.point
          const currentPointMatch = opt.label.match(/([+-]\d+\.?\d*)$/)
          const currentPoint = currentPointMatch ? Number(currentPointMatch[1]) : null
          update.pointChanged = currentPoint !== null && currentPoint !== outcome.point
        }

        proposed.push(update)
      }
    }

    // Process slate games — fetch the home-team spread from the API
    for (const game of slateGames) {
      const sportKey = SPORT_API_KEYS[game.sport_label]
      if (!sportKey) continue

      const apiGame = matchGame(game.away_team, game.home_team, oddsByKey[sportKey] ?? [], game.start_time_et)
      if (!apiGame) continue

      const market = pickMarket(apiGame, 'spreads')
      if (!market) continue

      // The home-team spread is what we store (positive = home is underdog, negative = home is favored)
      const homeOutcome = market.outcomes.find(o =>
        o.name.toLowerCase().includes(game.home_team.toLowerCase().split(' ').pop()!.toLowerCase())
      )
      if (!homeOutcome || homeOutcome.point === undefined) continue

      proposedSpreads.push({
        slateGameId:   game.id,
        gameName:      `${game.away_team} @ ${game.home_team}`,
        sport:         game.sport_label,
        currentSpread: game.spread,
        newSpread:     homeOutcome.point,
        changed:       game.spread !== homeOutcome.point,
      })
    }

    return { proposed, proposedSpreads, unmatched }
  } catch (e: any) {
    return { proposed: [], proposedSpreads: [], unmatched: [], error: e.message }
  }
}
