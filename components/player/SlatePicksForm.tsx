'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { submitSlatePicks } from '@/lib/actions/player/slate-picks'

interface SlateGame {
  id: string
  away_team: string
  home_team: string
  sport_label: string
  start_time_et: string
  spread: number | null
  notes: string | null
}

interface ExistingPick {
  slateGameId: string
  teamPicked: 'home' | 'away'
  confidenceRank: number
}

interface Props {
  betstravaganzaId: string
  slateGames: SlateGame[]
  existingPicks: ExistingPick[]
  slateLockTime: string | null
  confidenceMultiplier: number
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatLockTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// ─── Sortable game row ───────────────────────────────────────────────────────

function SortableGameRow({
  game,
  rank,
  totalGames,
  teamPicked,
  confidenceMultiplier,
  locked,
  onPickTeam,
}: {
  game: SlateGame
  rank: number
  totalGames: number
  teamPicked: 'home' | 'away' | null
  confidenceMultiplier: number
  locked: boolean
  onPickTeam: (gameId: string, team: 'home' | 'away') => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.id, disabled: locked })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  const potential = rank * confidenceMultiplier
  const isTop = rank === totalGames
  const isBottom = rank === 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-surface p-3 space-y-2 transition-all ${
        isDragging ? 'shadow-xl opacity-90 border-accent/60' : 'border-border'
      } ${isTop ? 'ring-1 ring-accent/30' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        {!locked && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-muted hover:text-white transition-colors p-1 -m-1 touch-none"
            aria-label="Drag to reorder"
            tabIndex={0}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6-10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </button>
        )}

        {/* Game info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">
            {game.away_team} @ {game.home_team}
          </div>
          <div className="text-xs text-muted">
            {game.sport_label} · {formatTime(game.start_time_et)}
            {game.spread !== null && ` · ${game.spread > 0 ? '+' : ''}${game.spread}`}
          </div>
        </div>

        {/* Rank + potential */}
        <div className="shrink-0 text-right space-y-0.5">
          <div className={`text-xs font-bold font-mono ${isTop ? 'text-accent' : isBottom ? 'text-muted' : 'text-white'}`}>
            #{rank}
          </div>
          <div className={`text-xs font-mono ${teamPicked ? 'text-win' : 'text-muted/50'}`}>
            +${potential}
          </div>
        </div>
      </div>

      {/* Team picker */}
      <div className="flex gap-2">
        <button
          aria-label={`${game.away_team} away`}
          onClick={() => !locked && onPickTeam(game.id, 'away')}
          disabled={locked}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
            teamPicked === 'away'
              ? 'border-accent bg-accent/10 text-accent'
              : locked
              ? 'border-border/40 bg-surface-2/50 text-muted/40 cursor-not-allowed'
              : 'border-border bg-surface-2 text-muted hover:text-white hover:border-border/80'
          }`}
        >
          {game.away_team}
          <span className="ml-1 text-xs opacity-60">away</span>
        </button>
        <button
          aria-label={`${game.home_team} home`}
          onClick={() => !locked && onPickTeam(game.id, 'home')}
          disabled={locked}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
            teamPicked === 'home'
              ? 'border-accent bg-accent/10 text-accent'
              : locked
              ? 'border-border/40 bg-surface-2/50 text-muted/40 cursor-not-allowed'
              : 'border-border bg-surface-2 text-muted hover:text-white hover:border-border/80'
          }`}
        >
          {game.home_team}
          <span className="ml-1 text-xs opacity-60">home</span>
        </button>
      </div>
    </div>
  )
}

// ─── Main form ───────────────────────────────────────────────────────────────

export function SlatePicksForm({
  betstravaganzaId,
  slateGames,
  existingPicks,
  slateLockTime,
  confidenceMultiplier,
}: Props) {
  const locked = !!(slateLockTime && new Date() > new Date(slateLockTime))

  // Build initial game order from existing picks (sorted by rank desc = most confident first)
  const initialOrder: string[] = (() => {
    if (existingPicks.length === slateGames.length) {
      return [...existingPicks]
        .sort((a, b) => b.confidenceRank - a.confidenceRank)
        .map(p => p.slateGameId)
    }
    return slateGames.map(g => g.id)
  })()

  // Team picks keyed by game ID
  const initialTeamPicks: Record<string, 'home' | 'away' | null> = {}
  for (const ep of existingPicks) {
    initialTeamPicks[ep.slateGameId] = ep.teamPicked
  }
  for (const g of slateGames) {
    if (!(g.id in initialTeamPicks)) initialTeamPicks[g.id] = null
  }

  const [gameOrder, setGameOrder] = useState<string[]>(initialOrder)
  const [teamPicks, setTeamPicks] = useState<Record<string, 'home' | 'away' | null>>(initialTeamPicks)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(existingPicks.length === slateGames.length)

  const n = slateGames.length
  const gameById = Object.fromEntries(slateGames.map(g => [g.id, g]))

  // Rank: position 0 = most confident = rank N
  function rankForPos(pos: number) { return n - pos }

  const allPicked = gameOrder.every(id => teamPicks[id] !== null)
  const canSubmit = allPicked && !locked

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setGameOrder(prev => {
        const oldIdx = prev.indexOf(active.id as string)
        const newIdx = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIdx, newIdx)
      })
      setSubmitted(false)
    }
  }

  const handlePickTeam = useCallback((gameId: string, team: 'home' | 'away') => {
    setTeamPicks(prev => ({ ...prev, [gameId]: team }))
    setSubmitted(false)
  }, [])

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    const result = await submitSlatePicks(
      betstravaganzaId,
      gameOrder.map((gId, i) => ({
        slateGameId: gId,
        teamPicked: teamPicks[gId] as 'home' | 'away',
        confidenceRank: rankForPos(i),
      }))
    )

    if (result.error) setError(result.error)
    else setSubmitted(true)
    setLoading(false)
  }

  const maxPotential = gameOrder.reduce((sum, _, i) => sum + rankForPos(i) * confidenceMultiplier, 0)

  return (
    <div className="space-y-4">
      {/* Lock banner */}
      {locked && slateLockTime && (
        <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
            <path d="M8 1a4 4 0 0 1 4 4v1h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1V5a4 4 0 0 1 4-4zm0 1.5A2.5 2.5 0 0 0 5.5 5v1h5V5A2.5 2.5 0 0 0 8 2.5z"/>
          </svg>
          <span>
            <strong>Slate locked</strong> — picks closed at {formatLockTime(slateLockTime)}.
            {submitted && ' Your picks are saved.'}
          </span>
        </div>
      )}

      {/* Instructions */}
      {!locked && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Drag to rank confidence — <strong className="text-white">top = most confident</strong></span>
          <span className="text-accent font-mono font-semibold">
            Up to +${maxPotential} if all correct
          </span>
        </div>
      )}

      {/* Locked pick summary (read-only) */}
      {locked && submitted && (
        <div className="text-xs text-muted">
          Drag to rank confidence — <strong className="text-white">top = most confident</strong>
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={gameOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {gameOrder.map((gId, i) => (
              <SortableGameRow
                key={gId}
                game={gameById[gId]}
                rank={rankForPos(i)}
                totalGames={n}
                teamPicked={teamPicks[gId]}
                confidenceMultiplier={confidenceMultiplier}
                locked={locked}
                onPickTeam={handlePickTeam}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {!locked && (
        <>
          {!allPicked && (
            <p className="text-xs text-muted">Pick a team for every game to submit.</p>
          )}
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!canSubmit}
            className="w-full"
          >
            {submitted ? '✓ Picks Submitted — Update' : 'Submit Slate Picks'}
          </Button>
        </>
      )}
    </div>
  )
}
