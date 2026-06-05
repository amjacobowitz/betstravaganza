'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { submitSlatePicks } from '@/lib/actions/player/slate-picks'

interface SlateGame {
  id: string
  away_team: string
  home_team: string
  sport_label: string
  start_time_et: string
  spread: number | null
  notes: string | null
  away_odds: number | null
  home_odds: number | null
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
  revealed?: boolean
}

function formatOdds(odds: number | null | undefined) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
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
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' ET'
}

// ─── Sortable game row ───────────────────────────────────────────────────────

function SortableGameRow({
  game,
  rank,
  totalGames,
  teamPicked,
  confidenceMultiplier,
  locked,
  hideAmounts,
  onPickTeam,
  onMoveUp,
  onMoveDown,
}: {
  game: SlateGame
  rank: number
  totalGames: number
  teamPicked: 'home' | 'away' | null
  confidenceMultiplier: number
  locked: boolean
  hideAmounts: boolean
  onPickTeam: (gameId: string, team: 'home' | 'away') => void
  onMoveUp: () => void
  onMoveDown: () => void
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
        {/* Reorder controls: drag handle + up/down arrows */}
        {!locked && (
          <div className="flex flex-col items-center gap-0.5 mt-0.5 shrink-0">
            <button
              onClick={onMoveUp}
              disabled={isTop}
              className="text-muted hover:text-white disabled:opacity-20 disabled:cursor-default transition-colors p-0.5"
              aria-label="Move up"
              tabIndex={0}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3l6 8H2z"/></svg>
            </button>
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted hover:text-white transition-colors p-0.5 touch-none"
              aria-label="Drag to reorder"
              tabIndex={0}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm6-10a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
              </svg>
            </button>
            <button
              onClick={onMoveDown}
              disabled={isBottom}
              className="text-muted hover:text-white disabled:opacity-20 disabled:cursor-default transition-colors p-0.5"
              aria-label="Move down"
              tabIndex={0}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 13L2 5h12z"/></svg>
            </button>
          </div>
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
            #{totalGames - rank + 1}
          </div>
          {!hideAmounts && (
            <div className={`text-xs font-mono ${teamPicked ? 'text-win' : 'text-muted/50'}`}>
              +${potential}
            </div>
          )}
        </div>
      </div>

      {/* Team picker */}
      <div className="flex gap-2">
        {(['away', 'home'] as const).map(side => {
          const team = side === 'away' ? game.away_team : game.home_team
          const odds = side === 'away' ? game.away_odds : game.home_odds
          const picked = teamPicked === side
          const oddsStr = formatOdds(odds)
          const oddsColor = odds == null ? 'text-muted/40' : odds > 0 ? 'text-win' : 'text-muted'
          return (
            <button
              key={side}
              aria-label={`${team} ${side}`}
              onClick={() => !locked && onPickTeam(game.id, side)}
              disabled={locked}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all text-left ${
                picked
                  ? 'border-accent bg-accent/10 text-accent'
                  : locked
                  ? 'border-border/40 bg-surface-2/50 text-muted/40 cursor-not-allowed'
                  : 'border-border bg-surface-2 text-muted hover:text-white hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span>
                  {team}
                  <span className="ml-1 text-xs opacity-60">{side}</span>
                </span>
                {oddsStr && (
                  <span className={`text-xs font-mono shrink-0 ${picked ? 'text-accent' : oddsColor}`}>
                    {oddsStr}
                  </span>
                )}
              </div>
            </button>
          )
        })}
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
  revealed = true,
}: Props) {
  const locked = !!(slateLockTime && new Date() > new Date(slateLockTime))

  // Build initial game order: saved picks sorted by rank desc, then unpicked games
  const initialOrder: string[] = (() => {
    if (existingPicks.length === 0) return slateGames.map(g => g.id)
    const pickedIds = new Set(existingPicks.map(p => p.slateGameId))
    const sortedPicked = [...existingPicks]
      .sort((a, b) => b.confidenceRank - a.confidenceRank)
      .map(p => p.slateGameId)
    const unpicked = slateGames.map(g => g.id).filter(id => !pickedIds.has(id))
    return [...sortedPicked, ...unpicked]
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
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(existingPicks.length)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle')
  const mountedRef = useRef(false)

  const n = slateGames.length
  const gameById = Object.fromEntries(slateGames.map(g => [g.id, g]))

  // Rank: position 0 = most confident = rank N
  function rankForPos(pos: number) { return n - pos }

  const pickedCount = gameOrder.filter(id => teamPicks[id] !== null).length
  const remaining = n - pickedCount

  // Auto-save whenever team picks or order changes (800ms debounce)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (locked) return

    const picked = gameOrder
      .map((gId, i) => ({ slateGameId: gId, teamPicked: teamPicks[gId], rank: n - i }))
      .filter(p => p.teamPicked !== null)

    if (picked.length === 0) return

    setSaveStatus('pending')

    const timer = setTimeout(async () => {
      const result = await submitSlatePicks(
        betstravaganzaId,
        picked.map(p => ({ slateGameId: p.slateGameId, teamPicked: p.teamPicked as 'home' | 'away', confidenceRank: p.rank })),
      )
      if (result.error) {
        setError(result.error)
        setSaveStatus('error')
      } else {
        setSavedCount(picked.length)
        setError(null)
        setSaveStatus('saved')
      }
    }, 800)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOrder, teamPicks])

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
    }
  }

  const handlePickTeam = useCallback((gameId: string, team: 'home' | 'away') => {
    setTeamPicks(prev => ({ ...prev, [gameId]: team }))
  }, [])

  function handleMove(gameId: string, direction: 'up' | 'down') {
    setGameOrder(prev => {
      const idx = prev.indexOf(gameId)
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      return arrayMove(prev, idx, newIdx)
    })
  }

  const maxPotential = gameOrder.reduce((sum, _, i) => sum + rankForPos(i) * confidenceMultiplier, 0)
  const allSaved = savedCount === n

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
            {savedCount > 0 && ` ${savedCount} of ${n} picks saved.`}
          </span>
        </div>
      )}

      {/* Instructions */}
      {!locked && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted/90">
            Pick a team for every game, then <strong className="text-white">drag or use the arrows to rank your confidence</strong> — the game at the top earns the most points if correct.
            You can change your order at any time{revealed ? '' : ' before the slate locks'}.
          </p>
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="italic">
              {remaining > 0
                ? `${remaining} game${remaining !== 1 ? 's' : ''} still need a pick`
                : allSaved
                  ? '✓ All picks saved'
                  : 'All teams picked'}
            </span>
            <span className="flex items-center gap-2">
              {saveStatus === 'pending' && <span className="text-muted/60">saving…</span>}
              {saveStatus === 'saved' && <span className="text-win">✓ saved</span>}
              {saveStatus === 'error' && <span className="text-danger">save failed</span>}
              {revealed && maxPotential > 0 && (
                <span className="text-accent font-mono font-semibold">Up to +${maxPotential}</span>
              )}
            </span>
          </div>
          <p className="text-xs text-muted/60">
            Winners determined <strong className="text-white/80">against the spread</strong> where listed.
          </p>
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
                hideAmounts={!revealed}
                onPickTeam={handlePickTeam}
                onMoveUp={() => handleMove(gId, 'up')}
                onMoveDown={() => handleMove(gId, 'down')}
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
    </div>
  )
}
