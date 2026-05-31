import type { SlatePick, SlateResult } from './types'

const POINTS_PER_RANK = 3

export function computeConfidenceBonus(picks: SlatePick[], results: SlateResult[]): number {
  const resultByGameId = new Map(results.map(r => [r.slateGameId, r]))

  return picks.reduce((total, pick) => {
    const result = resultByGameId.get(pick.slateGameId)
    if (!result) return total

    const winner = determineSlateWinner(result)
    if (winner === pick.teamPicked) {
      return total + pick.confidenceRank * POINTS_PER_RANK
    }
    return total
  }, 0)
}

function determineSlateWinner(result: SlateResult): 'home' | 'away' | 'push' {
  if (result.homeScore > result.awayScore) return 'home'
  if (result.awayScore > result.homeScore) return 'away'
  return 'push'
}
