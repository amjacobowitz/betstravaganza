export const SPORTS = [
  'Baseball',
  'Basketball',
  'Football',
  'Hockey',
  'Horse Racing',
  'Golf',
  'Soccer',
  'Auto Racing',
  'Tennis',
  'Boxing',
  'MMA',
  'Volleyball',
  'Lacrosse',
  'eSports',
  'Disc Golf',
  'Track & Field',
  'Cycling',
  'Bowling',
  'Cricket',
  'Australian Football',
  'Rugby',
  'Other',
] as const

export type Sport = typeof SPORTS[number]

const SPORT_EMOJI: Record<string, string> = {
  'Baseball':            '⚾',
  'Basketball':          '🏀',
  'Football':            '🏈',
  'Hockey':              '🏒',
  'Horse Racing':        '🏇',
  'Golf':                '⛳',
  'Soccer':              '⚽',
  'Auto Racing':         '🏎',
  'Tennis':              '🎾',
  'Boxing':              '🥊',
  'MMA':                 '🥋',
  'Volleyball':          '🏐',
  'Lacrosse':            '🥍',
  'eSports':             '🎮',
  'Disc Golf':           '🥏',
  'Track & Field':       '🏃',
  'Cycling':             '🚴',
  'Bowling':             '🎳',
  'Cricket':             '🏏',
  'Australian Football': '🏉',
  'Rugby':               '🏉',
  'Other':               '🎯',
}

export function sportEmoji(sport: string): string {
  return SPORT_EMOJI[sport] ?? '🏅'
}

export function sportLabel(sport: string): string {
  return `${sportEmoji(sport)} ${sport}`
}
