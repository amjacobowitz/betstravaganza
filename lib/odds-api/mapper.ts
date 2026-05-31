import type { OddsApiGame } from './client'

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

export function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
}

export function matchGame(
  ourAway: string,
  ourHome: string,
  apiGames: OddsApiGame[],
  referenceTime?: string, // slate game's start_time_et — used to prefer the closest date match
): OddsApiGame | null {
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
