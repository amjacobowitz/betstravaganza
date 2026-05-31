'use client'

import { useState, useMemo, useEffect } from 'react'
import { Badge, ClashBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { recordPick, undoPick, setDraftPickIndex, resetDraft } from '@/lib/actions/admin/draft'
import { validateDraftTurn, isClashPick } from '@/lib/scoring'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'
import { sportEmoji } from '@/lib/utils/sports'

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

// ─── Availability dot ────────────────────────────────────────────────────────

function AvailDot({ draftCount, maxDrafts }: { draftCount: number; maxDrafts: number }) {
  const base = 'mt-1 shrink-0 h-2 w-2 rounded-full'
  if (draftCount >= maxDrafts) return <span className={`${base} bg-zinc-600`} />
  if (draftCount > 0)          return <span className={`${base} bg-amber-400`} />
  return                              <span className={`${base} bg-emerald-500`} />
}

// ─── Pick Pool (grouped by event) ────────────────────────────────────────────

function PickPool({
  events, betOptions, scoringEvents, allPicks, allUsers,
  selectedUserId, selectedOptionId, onSelectOption, filter, search,
}: {
  events: any[]
  betOptions: BetOption[]
  scoringEvents: ScoringEvent[]
  allPicks: DraftPick[]
  allUsers: { id: string; name: string; team_name: string }[]
  selectedUserId: string
  selectedOptionId: string
  onSelectOption: (id: string) => void
  filter: 'all' | 'required' | 'optional'
  search: string
}) {
  // Events this player has already picked from (one pick per event per player)
  const myPickedEventIds = useMemo(() => {
    const myPicks = allPicks.filter(p => p.userId === selectedUserId)
    return new Set(myPicks.map(p => betOptions.find(o => o.id === p.betOptionId)?.eventId).filter(Boolean) as string[])
  }, [allPicks, selectedUserId, betOptions])

  const optionRows = useMemo(() => events.flatMap(e => {
    const opts = betOptions.filter(o => o.eventId === e.id)
    return opts.map(o => {
      const draftCount = allPicks.filter(p => p.betOptionId === o.id).length
      const isFull = draftCount >= o.maxDrafts
      const draftedBy = allPicks
        .filter(p => p.betOptionId === o.id)
        .map(p => allUsers.find(u => u.id === p.userId)?.team_name ?? '?')
      const eventOpts = betOptions.filter(oo => oo.eventId === o.eventId)
      const opposingOpt = eventOpts.length === 2 ? eventOpts.find(oo => oo.id !== o.id) : null
      const clashAvailable = !!(
        e.category === 'optional' && opposingOpt &&
        allPicks.some(p => p.betOptionId === opposingOpt.id)
      )
      return { event: e, option: o, draftCount, isFull, draftedBy, clashAvailable }
    })
  }), [events, betOptions, allPicks, allUsers])

  // Filter then group by event
  const groups = useMemo(() => {
    const filtered = optionRows.filter(r => {
      if (filter === 'required' && r.event.category !== 'required') return false
      if (filter === 'optional' && r.event.category !== 'optional') return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.option.label.toLowerCase().includes(q) && !r.event.name.toLowerCase().includes(q)) return false
      }
      return true
    })

    // Preserve event order from props
    return events
      .map(e => {
        const rows = filtered.filter(r => r.event.id === e.id)
        if (rows.length === 0) return null
        const allEventRows = optionRows.filter(r => r.event.id === e.id)
        const takenSlots = allEventRows.reduce((s, r) => s + r.draftCount, 0)
        const totalSlots = allEventRows.reduce((s, r) => s + r.option.maxDrafts, 0)
        return { event: e, rows, takenSlots, totalSlots }
      })
      .filter(Boolean) as { event: any; rows: typeof optionRows; takenSlots: number; totalSlots: number }[]
  }, [optionRows, filter, search, events])

  return (
    <Card className="overflow-hidden p-0">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-muted text-sm">No options match your filter.</div>
      )}
      {groups.map(({ event, rows, takenSlots, totalSlots }) => {
        const eventFull = takenSlots >= totalSlots
        return (
          <div key={event.id} className="border-b border-border/50 last:border-b-0">
            {/* Event header */}
            <div className={`flex items-center gap-2 px-4 py-2 ${eventFull ? 'bg-zinc-800/30' : 'bg-surface-2/50'}`}>
              <span className="text-base">{sportEmoji(event.sport)}</span>
              <span className={`font-semibold text-sm ${eventFull ? 'text-muted line-through' : 'text-white'}`}>
                {event.name}
              </span>
              <Badge variant={event.category === 'required' ? 'required' : 'default'} className="text-xs">
                {event.category.toUpperCase()}
              </Badge>
              <span className={`ml-auto text-xs font-mono tabular-nums ${
                eventFull ? 'text-muted' : takenSlots > 0 ? 'text-amber-400' : 'text-emerald-500'
              }`}>
                {takenSlots} / {totalSlots} slots taken
              </span>
            </div>

            {/* Option rows */}
            <div className="divide-y divide-border/30">
              {rows.map(({ option, isFull, draftCount, draftedBy, clashAvailable }) => {
                const isSelected = selectedOptionId === option.id
                const draftedByMe = allPicks.some(p => p.betOptionId === option.id && p.userId === selectedUserId)
                const eventPickedElsewhere = !draftedByMe && myPickedEventIds.has(option.eventId)
                const unavailable = isFull || draftedByMe || eventPickedElsewhere
                const showSlotCount = option.maxDrafts > 1

                return (
                  <button
                    key={option.id}
                    disabled={unavailable}
                    onClick={() => onSelectOption(isSelected ? '' : option.id)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all
                      ${isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : ''}
                      ${unavailable ? 'cursor-not-allowed' : 'hover:bg-surface-2/50'}
                    `}
                  >
                    <AvailDot draftCount={draftCount} maxDrafts={option.maxDrafts} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${unavailable ? 'line-through text-muted' : 'text-white'}`}>
                          {option.label}
                        </span>
                        {clashAvailable && !isFull && <ClashBadge />}
                        {isFull && <Badge variant="default">FULL</Badge>}
                        {draftedByMe && <Badge variant="win">Picked</Badge>}
                        {eventPickedElsewhere && <Badge variant="default">Event taken</Badge>}
                      </div>
                      {draftedBy.length > 0 && (
                        <div className="text-xs text-muted mt-0.5">{draftedBy.join(', ')}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <div className={`font-mono text-sm font-semibold ${
                        option.odds && option.odds > 0 ? 'text-win' : 'text-muted'
                      }`}>
                        {formatOdds(option.odds)}
                      </div>
                      {showSlotCount && (
                        <div className={`text-xs font-mono tabular-nums ${
                          isFull ? 'text-muted' : draftCount > 0 ? 'text-amber-400' : 'text-emerald-500'
                        }`}>
                          {draftCount}/{option.maxDrafts}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// ─── Draft Grid ───────────────────────────────────────────────────────────────

function cellPickIndex(round: number, playerIdx: number, n: number): number {
  const base = (round - 1) * n
  return round % 2 === 1 ? base + playerIdx : base + (n - 1 - playerIdx)
}

function onClockCell(pickIndex: number, n: number): { round: number; playerIdx: number } {
  if (n === 0) return { round: 1, playerIdx: 0 }
  const round = Math.floor(pickIndex / n) + 1
  const posInRound = pickIndex % n
  const playerIdx = round % 2 === 1 ? posInRound : n - 1 - posInRound
  return { round, playerIdx }
}

function DraftGrid({
  allPicks, allUsers, betOptions, scoringEvents, draftOrder, roundCount, bzId, events, currentPickIndex,
}: {
  allPicks: DraftPick[]
  allUsers: { id: string; name: string; team_name: string }[]
  betOptions: BetOption[]
  scoringEvents: ScoringEvent[]
  draftOrder: string[]
  roundCount: number
  bzId: string
  events: any[]
  currentPickIndex: number
}) {
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null)
  const [confirmClockCell, setConfirmClockCell] = useState<{ round: number; playerIdx: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const n = draftOrder.length
  const clock = onClockCell(currentPickIndex, n)

  async function handleUndo(pickId: string) {
    setLoading(true)
    setError(null)
    const result = await undoPick(bzId, pickId)
    if (result.error) setError(result.error)
    else setConfirmUndoId(null)
    setLoading(false)
  }

  async function handleSetClock(round: number, playerIdx: number) {
    setLoading(true)
    setError(null)
    const idx = cellPickIndex(round, playerIdx, n)
    const result = await setDraftPickIndex(bzId, idx)
    if (result.error) setError(result.error)
    else setConfirmClockCell(null)
    setLoading(false)
  }

  const playersInOrder = draftOrder
    .map(uid => allUsers.find(u => u.id === uid))
    .filter(Boolean) as typeof allUsers
  const extraPlayers = allUsers.filter(
    u => !draftOrder.includes(u.id) && allPicks.some(p => p.userId === u.id)
  )
  const players = [...playersInOrder, ...extraPlayers]

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-3 py-2 text-left text-xs text-muted font-semibold w-16">Round</th>
              {players.map((p, idx) => {
                const isClockColumn = clock.playerIdx === idx && clock.round <= roundCount
                return (
                  <th key={p.id} className={`px-3 py-2 text-left text-xs font-semibold min-w-[140px] ${isClockColumn ? 'text-accent-2' : 'text-white'}`}>
                    {p.team_name}
                    {isClockColumn && <span className="ml-1 text-accent-2">⏱</span>}
                    <div className="font-normal text-muted">{p.name}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: roundCount }, (_, i) => {
              const round = i + 1
              return (
                <tr key={round} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-2 text-xs text-muted font-mono font-semibold">{round}</td>
                  {players.map((p, playerIdx) => {
                    const pick = allPicks.find(dp => dp.userId === p.id && dp.roundNumber === round)
                    const option = pick ? betOptions.find(o => o.id === pick.betOptionId) : null
                    const event = pick ? scoringEvents.find(e => e.id === pick.eventId) : null
                    const isOnClock = clock.round === round && clock.playerIdx === playerIdx
                    const isConfirmingUndo = confirmUndoId === pick?.id
                    const isConfirmingClock = confirmClockCell?.round === round && confirmClockCell?.playerIdx === playerIdx

                    if (!pick || !option) {
                      // Empty cell — show on-clock indicator or click-to-set
                      return (
                        <td key={p.id} className={`px-3 py-2 ${isOnClock ? 'bg-accent-2/10' : ''}`}>
                          {isOnClock ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-accent-2">ON CLOCK</span>
                            </div>
                          ) : isConfirmingClock ? (
                            <div className="rounded border border-accent-2/40 bg-accent-2/10 p-1.5 space-y-1">
                              <p className="text-xs text-accent-2">Set as next pick?</p>
                              <div className="flex gap-1">
                                <Button size="sm" loading={loading} onClick={() => handleSetClock(round, playerIdx)}>Set</Button>
                                <Button size="sm" variant="ghost" onClick={() => setConfirmClockCell(null)}>✕</Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmClockCell({ round, playerIdx })}
                              className="w-full h-8 text-xs text-muted/30 hover:text-muted hover:bg-surface-2/60 rounded transition-colors"
                              title="Set as next on-clock position"
                            >
                              —
                            </button>
                          )}
                        </td>
                      )
                    }

                    return (
                      <td key={p.id} className="px-3 py-2 align-top">
                        {isConfirmingUndo ? (
                          <div className="rounded-lg border border-danger/40 bg-danger/10 p-2 space-y-1.5">
                            <p className="text-xs text-danger font-medium">Undo this pick?</p>
                            <p className="text-xs text-white font-semibold">{option.label}</p>
                            <div className="flex gap-1">
                              <Button size="sm" variant="danger" loading={loading} onClick={() => handleUndo(pick.id)}>
                                Undo
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmUndoId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg px-2 py-1.5 group hover:bg-surface-2/50 transition-colors">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white leading-tight">
                                  {option.label}
                                </div>
                                <div className="text-xs text-muted mt-0.5 leading-tight">
                                  {sportEmoji(events.find(e => e.id === pick?.eventId)?.sport ?? '')} {event?.name}
                                </div>
                              </div>
                              <button
                                onClick={() => setConfirmUndoId(pick.id)}
                                className="shrink-0 text-xs text-muted/30 hover:text-danger transition-colors opacity-0 group-hover:opacity-100 px-0.5 mt-0.5"
                                title="Undo this pick"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Player Roster ────────────────────────────────────────────────────────────

function PlayerRoster({
  userId, allPicks, betOptions, scoringEvents, requiredEventIds, roundCount, bzId, events,
}: {
  userId: string
  allPicks: DraftPick[]
  betOptions: BetOption[]
  scoringEvents: ScoringEvent[]
  requiredEventIds: string[]
  roundCount: number
  bzId: string
  events: any[]
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const playerPicks = allPicks.filter(p => p.userId === userId).sort((a, b) => a.roundNumber - b.roundNumber)

  async function handleUndo(pickId: string) {
    setLoading(true)
    setError(null)
    const result = await undoPick(bzId, pickId)
    if (result.error) setError(result.error)
    else setConfirmId(null)
    setLoading(false)
  }

  function renderPickRow(pick: DraftPick | null, label: string, eventName: string, eventSport: string, category: string) {
    const option = pick ? betOptions.find(o => o.id === pick.betOptionId) : null
    const isConfirming = pick && confirmId === pick.id

    return (
      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
        !pick ? 'border-dashed border-border/40 bg-surface/30' : 'border-border/50 bg-surface-2/40'
      }`}>
        <div className="mt-0.5 shrink-0">
          {pick
            ? <span className="text-emerald-500 text-xs font-bold">✓</span>
            : <span className="text-muted/40 text-xs font-bold">○</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted mb-0.5">
            {label}
            {category === 'required' && (
              <Badge variant="required" className="ml-1.5 text-xs">REQ</Badge>
            )}
          </div>
          {pick && option ? (
            <div className="text-sm font-semibold text-white">
              {sportEmoji(eventSport)} {option.label}
              <span className="ml-2 text-xs font-mono text-muted font-normal">{eventName}</span>
              <span className="ml-2 font-mono text-xs text-win">{formatOdds(option.odds)}</span>
            </div>
          ) : (
            <div className="text-sm text-muted/50 italic">Not yet picked</div>
          )}
        </div>
        {pick && (
          isConfirming ? (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="danger" loading={loading} onClick={() => handleUndo(pick.id)}>Undo</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>✕</Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmId(pick.id)}
              className="shrink-0 text-xs text-muted/40 hover:text-danger transition-colors px-1"
            >
              undo
            </button>
          )
        )}
      </div>
    )
  }

  const requiredPicks = requiredEventIds.map(eid => {
    const ev = scoringEvents.find(e => e.id === eid)
    const fullEv = events.find(e => e.id === eid)
    const pick = playerPicks.find(p => p.eventId === eid) ?? null
    return { ev, fullEv, pick }
  })

  const optionalPicks = playerPicks.filter(p => {
    const ev = scoringEvents.find(e => e.id === p.eventId)
    return ev?.category !== 'required'
  })

  const optionalRounds = Array.from({ length: roundCount }, (_, i) => i + 1).filter(r => {
    // Show round if: player has an optional pick in this round, OR this is a "free" round
    // (not used by a required pick)
    return !requiredPicks.some(rp => rp.pick?.roundNumber === r)
  })

  const coveredRequired = requiredPicks.filter(r => r.pick).length

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      {/* Required events */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Required Events</h3>
          <span className={`text-xs font-mono ${coveredRequired === requiredPicks.length ? 'text-win' : 'text-danger'}`}>
            {coveredRequired} / {requiredPicks.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {requiredPicks.map(({ ev, fullEv, pick }) => (
            <div key={ev?.id ?? 'unknown'}>
              {renderPickRow(pick, ev?.name ?? '?', ev?.name ?? '?', fullEv?.sport ?? '', 'required')}
            </div>
          ))}
          {requiredPicks.length === 0 && (
            <p className="text-xs text-muted italic px-1">No required events configured.</p>
          )}
        </div>
      </div>

      {/* Optional picks by round */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Optional Picks</h3>
          <span className="text-xs font-mono text-muted">{optionalPicks.length} picks</span>
        </div>
        <div className="space-y-1.5">
          {playerPicks
            .filter(p => scoringEvents.find(e => e.id === p.eventId)?.category !== 'required')
            .map(pick => {
              const ev = scoringEvents.find(e => e.id === pick.eventId)
              const fullEv = events.find(e => e.id === pick.eventId)
              return (
                <div key={pick.id}>
                  {renderPickRow(pick, `Round ${pick.roundNumber}`, ev?.name ?? '?', fullEv?.sport ?? '', 'optional')}
                </div>
              )
            })}
          {optionalPicks.length === 0 && (
            <p className="text-xs text-muted italic px-1">No optional picks yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main DraftBoard ──────────────────────────────────────────────────────────

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
  const [tab, setTab] = useState<'pool' | 'grid' | 'roster'>('pool')

  // Auto-advance selected player when the on-clock player changes after a pick
  useEffect(() => {
    if (currentUserId) setSelectedUserId(currentUserId)
  }, [currentUserId])
  const [filter, setFilter] = useState<'all' | 'required' | 'optional'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const requiredEventIds = scoringEvents.filter(e => e.category === 'required').map(e => e.id)
  const playerPicks = allPicks.filter(p => p.userId === selectedUserId)

  const selectedTeamName = allUsers.find(u => u.id === selectedUserId)?.team_name

  const validation = selectedUserId && selectedOptionId
    ? validateDraftTurn({
        userId: selectedUserId,
        proposedBetOptionId: selectedOptionId,
        playerPicks,
        allPicks,
        betOptions,
        events: scoringEvents,
        requiredEventIds,
        totalRounds: bz.round_count ?? 11,
        teamName: selectedTeamName,
      })
    : null

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

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

      {/* LEFT: Player sidebar */}
      <div className="w-full shrink-0 space-y-2 lg:w-72">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Players</h2>
          <div className="text-right">
            <div className="text-xs font-semibold text-white">
              Round {Math.min(Math.floor(currentPickIndex / (draftOrder.length || 1)) + 1, bz.round_count ?? 1)} of {bz.round_count}
            </div>
            <div className="text-xs text-muted">Pick {currentPickIndex + 1} / {totalPicks}</div>
          </div>
        </div>

        {/* Reset Draft */}
        {confirmReset ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 space-y-2">
            <p className="text-sm font-semibold text-danger">Reset entire draft?</p>
            <p className="text-xs text-muted">All picks will be deleted and the pick index reset to 0.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                loading={resetLoading}
                onClick={async () => {
                  setResetLoading(true)
                  const res = await resetDraft(bz.id)
                  if (res.error) setError(res.error)
                  else setConfirmReset(false)
                  setResetLoading(false)
                }}
              >
                Yes, Reset
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full rounded-lg border border-danger/20 px-3 py-1.5 text-xs text-danger/60 hover:text-danger hover:border-danger/50 transition-colors text-left"
          >
            Reset Draft
          </button>
        )}

        {playerStatuses.map(p => {
          const isCurrent = p.userId === currentUserId
          const isSelected = p.userId === selectedUserId
          const needsRequired = p.requiredRemaining.length >= p.roundsRemaining
          return (
            <button
              key={p.userId}
              onClick={() => { setSelectedUserId(p.userId); setTab('roster') }}
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
                <span className={`text-xs font-mono ${p.totalPicks > bz.round_count ? 'text-danger' : 'text-muted'}`}>
                  {p.totalPicks}/{bz.round_count}
                  {p.totalPicks > bz.round_count && ' ⚠'}
                </span>
              </div>

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

              {needsRequired && p.roundsRemaining > 0 && (
                <div className="mt-2 rounded bg-danger/10 border border-danger/30 px-2 py-1 text-xs text-danger">
                  ⚠️ Must pick required only ({p.requiredRemaining.length} left, {p.roundsRemaining} rounds)
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* RIGHT: Main area */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Tab bar + context header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            {([['pool', 'Pick Pool'], ['grid', 'Draft Grid'], ['roster', 'Roster']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
                  ${tab === key ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'pool' && selectedOptionId && validation && (
            <div className={`rounded-lg border px-3 py-1.5 text-sm ${validation.valid ? 'border-win/30 bg-win/10 text-win' : 'border-danger/30 bg-danger/10 text-danger'}`}>
              {validation.valid ? '✓ Valid pick' : `✗ ${validation.reason}`}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
        )}

        {/* Pick Pool tab */}
        {tab === 'pool' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {currentPlayer ? `Picking for: ${currentPlayer.teamName}` : 'Select a player'}
              </h2>
            </div>
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
            <PickPool
              events={events}
              betOptions={betOptions}
              scoringEvents={scoringEvents}
              allPicks={allPicks}
              allUsers={allUsers}
              selectedUserId={selectedUserId}
              selectedOptionId={selectedOptionId}
              onSelectOption={setSelectedOptionId}
              filter={filter}
              search={search}
            />
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
          </>
        )}

        {/* Draft Grid tab */}
        {tab === 'grid' && (
          <>
            <h2 className="text-lg font-bold text-white">Draft Grid</h2>
            <DraftGrid
              allPicks={allPicks}
              allUsers={allUsers}
              betOptions={betOptions}
              scoringEvents={scoringEvents}
              draftOrder={draftOrder}
              roundCount={bz.round_count ?? 11}
              bzId={bz.id}
              events={events}
              currentPickIndex={currentPickIndex}
            />
          </>
        )}

        {/* Roster tab */}
        {tab === 'roster' && (
          <>
            <h2 className="text-lg font-bold text-white">
              {currentPlayer ? `${currentPlayer.teamName} — Roster` : 'Select a player'}
            </h2>
            {selectedUserId ? (
              <PlayerRoster
                userId={selectedUserId}
                allPicks={allPicks}
                betOptions={betOptions}
                scoringEvents={scoringEvents}
                requiredEventIds={requiredEventIds}
                roundCount={bz.round_count ?? 11}
                bzId={bz.id}
                events={events}
              />
            ) : (
              <Card><p className="text-muted text-sm text-center py-4">Select a player in the sidebar.</p></Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
