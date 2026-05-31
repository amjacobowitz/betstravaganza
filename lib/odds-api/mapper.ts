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
): OddsApiGame | null {
  const normAway = normalizeTeam(ourAway)
  const normHome = normalizeTeam(ourHome)

  for (const g of apiGames) {
    const apiAway = normalizeTeam(g.away_team)
    const apiHome = normalizeTeam(g.home_team)
    const awayMatch = apiAway.includes(normAway) || normAway.includes(apiAway)
    const homeMatch = apiHome.includes(normHome) || normHome.includes(apiHome)
    if (awayMatch && homeMatch) return g
  }
  return null
}
