const BASE = 'https://api.the-odds-api.com/v4'

export interface OddsApiGame {
  id: string
  sport_key: string
  commence_time: string
  completed: boolean
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
  last_update: string | null
}

export async function fetchScores(sportKey: string): Promise<OddsApiGame[]> {
  const key = process.env.ODDS_API_KEY
  if (!key) throw new Error('ODDS_API_KEY not configured')
  const res = await fetch(
    `${BASE}/sports/${sportKey}/scores?apiKey=${key}&daysFrom=3&dateFormat=iso`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Odds API ${res.status}: ${text}`)
  }
  return res.json()
}
