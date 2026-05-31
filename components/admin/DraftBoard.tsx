'use client'

import { useState, useMemo } from 'react'
import { Badge, ClashBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { recordPick, undoLastPick } from '@/lib/actions/admin/draft'
import { validateDraftTurn, isClashPick } from '@/lib/scoring'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

interface PlayerStatus {
  userId: string
  name: string
  teamName: string
  totalPicks: number
  requiredSatisfied: number
  requiredTotal: number
  clashCount: number
  clashRequired: number
  requiredRemaining: string[]
  roundsRemaining: number
}

interface Props {
  betstravaganza: any
  events: any[]
  betOptions: BetOption[]
  scoringEvents: ScoringEvent[]
  allPicks: DraftPick[]
  playerStatuses: PlayerStatus[]
  currentUserId: string | null
  currentPickIndex: number
  totalPicks: number
  draftOrder: string[]
  allUsers: { id: string; name: string; team_name: string }[]
}

function formatOdds(odds: number | null) {
  if (odds === null) return '—'
  return odds > 0 ? `+${odds}` : `${odds}`
}

export function DraftBoard({
  betstravaganza: bz,
  events,
  betOptions,
  scoringEvents,
  allPicks,
  playerStatuses,
  currentUserId,
  currentPickIndex,
  totalPicks,
  draftOrder,
  allUsers,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId ?? '')
  const [selectedOptionId, setSelectedOptionId] = useState<string>('')
  const [filter, setFilter] = useState<'all' | 'required' | 'optional'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiredEventIds = scoringEvents.filter(e => e.category === 'required').map(e => e.id)
  const playerPicks = allPicks.filter(p => p.userId === selectedUserId)

  const validation = selectedOptionId
    ? validateDraftTurn({
        userId: selectedUserId,
        proposedBetOptionId: selectedOptionId,
        playerPicks,
        allPicks,
        betOptions,
        events: scoringEvents,
        requiredEventIds,
        totalRounds: bz.round_count ?? 11,
      })
    : null

  // Build option list with availability info
  const optionRows = useMemo(() => {
    return events.flatMap(e => {
      const opts = betOptions.filter(o => o.eventId === e.id)
      return opts.map(o => {
        const draftCount = allPicks.filter(p => p.betOptionId === o.id).length
        const isFull = draftCount >= o.maxDrafts
        const draftedBy = allPicks
          .filter(p => p.betOptionId === o.id)
          .map(p => allUsers.find(u => u.id === p.userId)?.name ?? '?')

        // Clash check: is the opposing side already picked?
        const eventOpts = betOptions.filter(oo => oo.eventId === o.eventId)
        const opposingOpt = eventOpts.length === 2 ? eventOpts.find(oo => oo.id !== o.id) : null
        const clashAvailable = !!(
          e.category === 'optional' &&
          opposingOpt &&
          allPicks.some(p => p.betOptionId === opposingOpt.id)
        )

        return { event: e, option: o, draftCount, isFull, draftedBy, clashAvailable }
      })
    })
  }, [events, betOptions, allPicks, allUsers])

  const filteredRows = optionRows.filter(r => {
    if (filter === 'required' && r.event.category !== 'required') return false
    if (filter === 'optional' && r.event.category !== 'optional') return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.option.label.toLowerCase().includes(q) && !r.event.name.toLowerCase().includes(q)) return false
    }
    return true
  })

  const currentPlayer = playerStatuses.find(p => p.userId === selectedUserId)

  async function handleRecord() {
    if (!selectedUserId || !selectedOptionId) return
    setLoading(true)
    setError(null)
    const result = await recordPick({
      betstravaganzaId: bz.id,
      userId: selectedUserId,
      betOptionId: selectedOptionId,
      roundNumber: Math.floor(currentPickIndex / (draftOrder.length || 1)) + 1,
      pickIndex: currentPickIndex,
    })
    if (result.error) setError(result.error)
    else setSelectedOptionId('')
    setLoading(false)
  }

  async function handleUndo() {
    setLoading(true)
    const result = await undoLastPick(bz.id)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

      {/* LEFT: Player sidebar */}
      <div className="w-full shrink-0 space-y-2 lg:w-72">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Players</h2>
          <span className="text-xs text-muted">Pick {currentPickIndex + 1} / {totalPicks}</span>
        </div>

        {playerStatuses.map(p => {
          const isCurrent = p.userId === currentUserId
          const isSelected = p.userId === selectedUserId
          const needsRequired = p.requiredRemaining.length >= p.roundsRemaining
          return (
            <button
              key={p.userId}
              onClick={() => setSelectedUserId(p.userId)}
              className={`w-full rounded-xl border p-3 text-left transition-all
                ${isSelected ? 'border-accent bg-accent/10' : isCurrent ? 'border-accent-2 bg-accent-2/5' : 'border-border bg-surface hover:border-border/80'}
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {isCurrent && <span className="text-xs font-bold text-accent-2">ON CLOCK</span>}
                    <span className="font-semibold text-white text-sm">{p.teamName}</span>
                  </div>
                  <div className="text-xs text-muted">{p.name}</div>
                </div>
                <span className="text-xs font-mono text-muted">{p.totalPicks}/{bz.round_count}</span>
              </div>

              {/* Required categories status */}
              <div className="mt-2 space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Required</span>
                  <span className={p.requiredSatisfied === p.requiredTotal ? 'text-win' : needsRequired ? 'text-danger' : 'text-accent-2'}>
                    {p.requiredSatisfied}/{p.requiredTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Clashes</span>
                  <span className={p.clashCount >= p.clashRequired ? 'text-win' : 'text-clash'}>
                    {p.clashCount}/{p.clashRequired}
                  </span>
                </div>
              </div>

              {/* Warning if must pick required */}
              {needsRequired && p.roundsRemaining > 0 && (
                <div className="mt-2 rounded bg-danger/10 border border-danger/30 px-2 py-1 text-xs text-danger">
                  ⚠️ Must pick required only ({p.requiredRemaining.length} left, {p.roundsRemaining} rounds)
                </div>
              )}
            </button>
          )
        })}

        <Button variant="ghost" size="sm" onClick={handleUndo} loading={loading} className="w-full text-muted">
          ↩ Undo Last Pick
        </Button>
      </div>

      {/* RIGHT: Pick pool */}
      <div className="flex-1 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">
            {currentPlayer ? `Picking for: ${currentPlayer.teamName}` : 'Select a player'}
          </h2>

          {/* Validation feedback */}
          {selectedOptionId && validation && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${validation.valid ? 'border-win/30 bg-win/10 text-win' : 'border-danger/30 bg-danger/10 text-danger'}`}>
              {validation.valid ? '✓ Valid pick' : `✗ ${validation.reason}`}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'required', 'optional'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-colors
                ${filter === f ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}
            >
              {f}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 rounded-lg bg-surface-2 border border-border px-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Option rows */}
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border/50">
            {filteredRows.map(({ event, option, isFull, draftedBy, clashAvailable }) => {
              const isSelected = selectedOptionId === option.id
              const draftedByMe = allPicks.some(p => p.betOptionId === option.id && p.userId === selectedUserId)

              return (
                <button
                  key={option.id}
                  disabled={isFull || draftedByMe}
                  onClick={() => setSelectedOptionId(isSelected ? '' : option.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all
                    ${isSelected ? 'bg-accent/10 border-l-2 border-accent' : ''}
                    ${isFull || draftedByMe ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-2/50'}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${isFull || draftedByMe ? 'line-through text-muted' : 'text-white'}`}>
                        {option.label}
                      </span>
                      {event.category === 'required' && <Badge variant="required" className="text-xs">REQ</Badge>}
                      {clashAvailable && !isFull && <ClashBadge />}
                      {isFull && <Badge variant="default">FULL</Badge>}
                      {draftedByMe && <Badge variant="win">YOU HAVE</Badge>}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {event.name}
                      {draftedBy.length > 0 && ` · Drafted: ${draftedBy.join(', ')}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`font-mono text-sm font-semibold ${
                      option.odds && option.odds > 0 ? 'text-win' :
                      option.odds && option.odds < 0 ? 'text-muted' : 'text-muted'
                    }`}>
                      {formatOdds(option.odds)}
                    </span>
                  </div>
                </button>
              )
            })}
            {filteredRows.length === 0 && (
              <div className="px-4 py-8 text-center text-muted text-sm">No options match your filter.</div>
            )}
          </div>
        </Card>

        {/* Record button */}
        <div className="sticky bottom-4">
          <Button
            size="lg"
            onClick={handleRecord}
            loading={loading}
            disabled={!selectedUserId || !selectedOptionId || !validation?.valid}
            className="w-full shadow-2xl"
          >
            {selectedOptionId
              ? `Record Pick: ${betOptions.find(o => o.id === selectedOptionId)?.label ?? ''}`
              : 'Select a pick above'}
          </Button>
        </div>
      </div>
    </div>
  )
}
