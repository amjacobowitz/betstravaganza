import { computePayout } from './payout'
import type {
  DraftPick,
  BetOption,
  ScoringEvent,
  EventResult,
  Outcome,
  BankrollResult,
  ComputeBankrollInput,
} from './types'

export function computeOutcome(
  betOptionId: string,
  result: EventResult | null | undefined,
  event: ScoringEvent,
): Outcome {
  if (!result) return 'pending'

  // Use array if populated (new records and backfilled legacy records)
  if (result.winnerBetOptionIds.length > 0) {
    return result.winnerBetOptionIds.includes(betOptionId) ? 'win' : 'loss'
  }

  // Legacy: fall back to single winner field
  if (!result.winnerBetOptionId && result.resultDisplay.toLowerCase().includes('push')) {
    return 'push'
  }
  if (result.winnerBetOptionId === betOptionId) return 'win'
  if (result.winnerBetOptionId !== null) return 'loss'

  return 'pending'
}

export function computePlayerBankroll({
  picks,
  betOptions,
  events,
  results,
  startingBankroll,
  stake,
}: ComputeBankrollInput): BankrollResult {
  const resultByEventId = new Map(results.map(r => [r.eventId, r]))

  let totalDelta = 0
  let pendingCount = 0

  const pickDetails = picks.map(pick => {
    const option = betOptions.find(bo => bo.id === pick.betOptionId)
    const event = events.find(e => e.id === pick.eventId)
    const result = event ? resultByEventId.get(event.id) : undefined

    const outcome = option && event ? computeOutcome(pick.betOptionId, result, event) : 'pending'
    const payout = option ? computePayout(option.odds, stake, outcome) : 0

    if (outcome === 'pending') pendingCount++
    totalDelta += payout

    return { pickId: pick.id, betOptionId: pick.betOptionId, outcome, payout }
  })

  return {
    total: startingBankroll + totalDelta,
    realized: totalDelta,
    pending: pendingCount,
    picks: pickDetails,
  }
}
