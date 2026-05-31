import type { Outcome } from './types'

export function computePayout(odds: number | null, stake: number, outcome: Outcome): number {
  if (outcome === 'pending' || outcome === 'push') return 0
  if (outcome === 'loss') return -stake

  // win
  if (odds === null) return stake // flat payout for no-odds events
  if (odds === 0) throw new Error('Odds cannot be zero')
  if (odds > 0) return stake * (odds / 100)
  return stake * (100 / Math.abs(odds))
}
