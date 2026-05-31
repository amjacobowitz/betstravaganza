'use server'

import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/odds-api/client'
import { SPORT_API_KEYS, normalizeTeam, parseMatchup, findOutcomeForLabel } from '@/lib/odds-api/mapper'
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

function matchGameByTeams(away: string, home: string, games: OddsApiOddsGame[]): OddsApiOddsGame | null {
  const normAway = normalizeTeam(away)
  const normHome = normalizeTeam(home)
  return (
    games.find(g => {
      const a = normalizeTeam(g.away_team)
      const h = normalizeTeam(g.home_team)
      return (a.includes(normAway) || normAway.includes(a)) &&
             (h.includes(normHome) || normHome.includes(h))
    }) ?? null
  )
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

export interface UnmatchedEvent {
  eventId: string
  eventName: string
  sport: string
  reason: 'no_api_sport' | 'not_a_matchup' | 'no_game_match' | 'no_odds_data'
}

export interface FetchOddsResponse {
  proposed: ProposedOddsUpdate[]
  unmatched: UnmatchedEvent[]
  error?: string
}

// Server action ────────────────────────────────────────────────────────────────

export async function fetchOddsFromAPI(bzId: string): Promise<FetchOddsResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { proposed: [], unmatched: [], error: 'Not authenticated' }
    const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return { proposed: [], unmatched: [], error: 'Not authorized' }

    const { data: events } = await supabase
      .from('events')
      .select('id, name, sport, bet_type, bet_options(id, label, odds)')
      .eq('betstravaganza_id', bzId)
      .neq('bet_type', 'no_odds')

    if (!events?.length) return { proposed: [], unmatched: [] }

    // Determine which markets each sport needs (minimizes API credit usage)
    const sportMarkets: Record<string, Set<string>> = {}
    for (const ev of events) {
      const sportKey = SPORT_API_KEYS[ev.sport]
      if (!sportKey || !parseMatchup(ev.name)) continue
      const market = ev.bet_type === 'spread' ? 'spreads' : 'h2h'
      if (!sportMarkets[sportKey]) sportMarkets[sportKey] = new Set()
      sportMarkets[sportKey].add(market)
    }

    const oddsByKey: Record<string, OddsApiOddsGame[]> = {}
    await Promise.allSettled(
      Object.entries(sportMarkets).map(async ([key, markets]) => {
        oddsByKey[key] = await fetchOdds(key, [...markets])
      })
    )

    const proposed: ProposedOddsUpdate[] = []
    const unmatched: UnmatchedEvent[] = []

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

      const apiGame = matchGameByTeams(matchup.away, matchup.home, oddsByKey[sportKey] ?? [])
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
          betOptionId:  opt.id,
          optionLabel:  opt.label,
          eventId:      ev.id,
          eventName:    ev.name,
          currentOdds:  opt.odds,
          newOdds:      outcome.price,
          changed:      opt.odds !== outcome.price,
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

    return { proposed, unmatched }
  } catch (e: any) {
    return { proposed: [], unmatched: [], error: e.message }
  }
}
