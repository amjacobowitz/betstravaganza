export type Outcome = 'win' | 'loss' | 'push' | 'pending'
export type BetType = 'odds' | 'spread' | 'no_odds'
export type EventCategory = 'required' | 'optional'

export interface ScoringEvent {
  id: string
  name: string
  category: EventCategory
  betType: BetType
}

export interface BetOption {
  id: string
  eventId: string
  label: string
  odds: number | null
  maxDrafts: number
  draftCount: number
}

export interface DraftPick {
  id: string
  userId: string
  betOptionId: string
  eventId: string
  roundNumber: number
  createdAt: Date
}

export interface EventResult {
  id: string
  eventId: string
  winnerBetOptionId: string | null
  winnerBetOptionIds: string[]
  homeScore: number | null
  awayScore: number | null
  resultDisplay: string
}

export interface SlatePick {
  id: string
  userId: string
  slateGameId: string
  teamPicked: 'home' | 'away'
  confidenceRank: number
  submittedAt: Date
}

export interface SlateResult {
  id: string
  slateGameId: string
  homeScore: number
  awayScore: number
  resultDisplay: string
}

export interface BankrollResult {
  total: number
  realized: number
  pending: number
  picks: Array<{
    pickId: string
    betOptionId: string
    outcome: Outcome
    payout: number
  }>
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  requiredRemaining: string[]
  clashPicksNeeded: number
}

export interface ValidateDraftTurnInput {
  userId: string
  proposedBetOptionId: string
  playerPicks: DraftPick[]
  allPicks: DraftPick[]
  betOptions: BetOption[]
  events: ScoringEvent[]
  requiredEventIds: string[]
  totalRounds: number
  teamName?: string
}

export interface ComputeBankrollInput {
  picks: DraftPick[]
  betOptions: BetOption[]
  events: ScoringEvent[]
  results: EventResult[]
  startingBankroll: number
  stake: number
}
