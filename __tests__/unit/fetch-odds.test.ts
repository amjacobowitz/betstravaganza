import { describe, it, expect } from 'vitest'
import { parseMatchup, findOutcomeForLabel } from '@/lib/odds-api/mapper'
import type { OddsApiOutcome } from '@/lib/odds-api/client'

describe('parseMatchup', () => {
  it('parses "Away @ Home" correctly', () => {
    expect(parseMatchup('Yankees @ Red Sox')).toEqual({ away: 'Yankees', home: 'Red Sox' })
    expect(parseMatchup('Dodgers @ Giants')).toEqual({ away: 'Dodgers', home: 'Giants' })
    expect(parseMatchup('OKC Thunder @ Indiana Pacers')).toEqual({ away: 'OKC Thunder', home: 'Indiana Pacers' })
  })

  it('returns null for non-matchup event names', () => {
    expect(parseMatchup('MLB HR Race')).toBeNull()
    expect(parseMatchup('NBA Playoff Game')).toBeNull()
    expect(parseMatchup('Strikeout Props')).toBeNull()
  })
})

describe('findOutcomeForLabel', () => {
  const mlbOutcomes: OddsApiOutcome[] = [
    { name: 'New York Yankees', price: -130 },
    { name: 'Boston Red Sox', price: 110 },
  ]

  it('matches team nickname in option label', () => {
    expect(findOutcomeForLabel('Yankees Win', mlbOutcomes)?.price).toBe(-130)
    expect(findOutcomeForLabel('Red Sox Win', mlbOutcomes)?.price).toBe(110)
  })

  it('matches option labels for NL teams', () => {
    const nlOutcomes: OddsApiOutcome[] = [
      { name: 'Los Angeles Dodgers', price: -150 },
      { name: 'San Francisco Giants', price: 130 },
    ]
    expect(findOutcomeForLabel('Dodgers Win', nlOutcomes)?.price).toBe(-150)
    expect(findOutcomeForLabel('Giants Win', nlOutcomes)?.price).toBe(130)
  })

  it('matches spread option labels with point suffix', () => {
    const spreadOutcomes: OddsApiOutcome[] = [
      { name: 'Oklahoma City Thunder', price: -110, point: -6.5 },
      { name: 'Indiana Pacers', price: -110, point: 6.5 },
    ]
    expect(findOutcomeForLabel('OKC Thunder -6.5', spreadOutcomes)?.name).toBe('Oklahoma City Thunder')
    expect(findOutcomeForLabel('Indiana Pacers +6.5', spreadOutcomes)?.name).toBe('Indiana Pacers')
  })

  it('returns null when no label words match', () => {
    expect(findOutcomeForLabel('Dodgers Win', mlbOutcomes)).toBeNull()
  })

  it('does not match on stop words like "Win"', () => {
    // "Win" alone should not match any outcome
    const outcomes: OddsApiOutcome[] = [{ name: 'Win Corp', price: 100 }]
    expect(findOutcomeForLabel('Win', outcomes)).toBeNull()
  })
})
