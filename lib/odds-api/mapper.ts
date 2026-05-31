import type { OddsApiOutcome } from './client'

type TeamMatchable = { away_team: string; home_team: string; commence_time: string }

// Maps our sport labels to The Odds API sport keys
export const SPORT_API_KEYS: Record<string, string> = {
  'Baseball':            'baseball_mlb',
  'Basketball':          'basketball_nba',
  'Football':            'americanfootball_nfl',
  'Hockey':              'icehockey_nhl',
  'Soccer':              'soccer_usa_mls',
  'Tennis':              'tennis_atp_french_open',
  'Boxing':              'boxing_boxing',
  'MMA':                 'mma_mixed_martial_arts',
  'Cricket':             'cricket_ipl',
  'Australian Football': 'aussierules_afl',
  'Rugby':               'rugbyleague_nrl',
}

const ODDS_STOP_WORDS = new Set(['win', 'wins', 'over', 'under', 'the', 'at', 'vs', 'and'])

export function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

export function parseMatchup(eventName: string): { away: string; home: string } | null {
  const parts = eventName.split(' @ ')
  if (parts.length !== 2) return null
  return { away: parts[0].trim(), home: parts[1].trim() }
}

export function findOutcomeForLabel(label: string, outcomes: OddsApiOutcome[]): OddsApiOutcome | null {
  const labelWords = normalizeTeam(label)
    .split(/\s+/)
    .filter(w => w.length > 2 && !ODDS_STOP_WORDS.has(w))
  if (labelWords.length === 0) return null
  return (
    outcomes.find(o => {
      const nameWords = normalizeTeam(o.name).split(/\s+/)
      return labelWords.some(w => nameWords.includes(w))
    }) ?? null
  )
}

export function matchGame<T extends TeamMatchable>(
  ourAway: string,
  ourHome: string,
  apiGames: T[],
  referenceTime?: string, // slate game's start_time_et — used to prefer the closest date match
): T | null {
  const normAway = normalizeTeam(ourAway)
  const normHome = normalizeTeam(ourHome)

  const candidates = apiGames.filter(g => {
    const apiAway = normalizeTeam(g.away_team)
    const apiHome = normalizeTeam(g.home_team)
    const awayMatch = apiAway.includes(normAway) || normAway.includes(apiAway)
    const homeMatch = apiHome.includes(normHome) || normHome.includes(apiHome)
    return awayMatch && homeMatch
  })

  if (candidates.length === 0) return null
  if (!referenceTime || candidates.length === 1) return candidates[0]

  // Multiple candidates (same teams played multiple times) — pick the one
  // whose commence_time is closest to the slate game's start_time_et.
  const ref = new Date(referenceTime).getTime()
  return candidates.reduce((best, g) => {
    const bestDiff = Math.abs(new Date(best.commence_time).getTime() - ref)
    const gDiff    = Math.abs(new Date(g.commence_time).getTime()   - ref)
    return gDiff < bestDiff ? g : best
  })
}
