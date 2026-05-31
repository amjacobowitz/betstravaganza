'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { upsertResult, upsertSlateResult, deleteSlateResult } from '@/lib/actions/admin/results'
import { fetchResultsFromAPI } from '@/lib/actions/admin/fetch-results'
import type { ProposedSlateResult, NotFoundSlateGame } from '@/lib/actions/admin/fetch-results'
import { sportEmoji } from '@/lib/utils/sports'

type GameStatus = 'not_started' | 'in_progress' | 'complete'

function getStatus(startTimeEt: string | null, hasResult: boolean, now: Date): GameStatus {
  if (hasResult) return 'complete'
  if (!startTimeEt || new Date(startTimeEt) > now) return 'not_started'
  return 'in_progress'
}

const statusLabel: Record<GameStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete:    'Complete',
}

const statusBadge: Record<GameStatus, 'default' | 'pending' | 'win'> = {
  not_started: 'default',
  in_progress: 'pending',
  complete:    'win',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BetOption {
  id: string
  label: string
  odds: number | null
}

interface Event {
  id: string
  name: string
  sport: string
  bet_type: string
  category: string
  start_time_et: string | null
  bet_options: BetOption[]
  result?: {
    winner_bet_option_id: string | null
    winner_bet_option_ids?: string[] | null
    home_score: number | null
    away_score: number | null
    result_display: string
  } | null
}

interface SlateGame {
  id: string
  away_team: string
  home_team: string
  sport_label: string
  start_time_et: string | null
  result?: {
    home_score: number
    away_score: number
    result_display: string
  } | null
}

// ─── Event result row ─────────────────────────────────────────────────────────

function EventResultRow({ event, now, bzId }: { event: Event; now: Date; bzId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [localResult, setLocalResult] = useState(event.result)
  const r = localResult
  const status = getStatus(event.start_time_et, !!r, now)

  // Pre-populate checked winners from saved result
  const initialWinners = new Set<string>(
    r?.winner_bet_option_ids?.length
      ? r.winner_bet_option_ids
      : r?.winner_bet_option_id
        ? [r.winner_bet_option_id]
        : []
  )
  const [checkedWinners, setCheckedWinners] = useState<Set<string>>(initialWinners)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(t)
  }, [saved])

  function toggleWinner(id: string) {
    setCheckedWinners(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    // Inject checked winners since checkboxes only submit when checked
    fd.delete('winnerBetOptionId')
    checkedWinners.forEach(id => fd.append('winnerBetOptionId', id))
    const result = await upsertResult(fd)
    if (result.error) {
      setError(result.error)
    } else {
      const ids = Array.from(checkedWinners)
      setLocalResult({
        winner_bet_option_id: ids[0] ?? null,
        winner_bet_option_ids: ids,
        home_score: fd.get('homeScore') ? Number(fd.get('homeScore')) : null,
        away_score: fd.get('awayScore') ? Number(fd.get('awayScore')) : null,
        result_display: ids.length === 0 ? 'Push' : '',
      })
      setSaved(true)
    }
    setLoading(false)
  }

  const isSpreadType = event.bet_type === 'spread'

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="bzId" value={bzId} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-semibold text-white text-sm">
            {sportEmoji(event.sport)} {event.name}
          </span>
          <span className="ml-2 text-xs text-muted">{event.sport} · {event.bet_type}</span>
        </div>
        <Badge variant={statusBadge[status]}>{statusLabel[status]}</Badge>
      </div>
      {saved && <p className="text-xs text-win">✓ Saved</p>}

      {event.bet_options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted">Winner(s) — check all that apply</p>
          <div className="rounded-lg border border-border/50 bg-surface-2/40 p-2 max-h-48 overflow-y-auto space-y-1">
            {event.bet_options.map(o => (
              <label
                key={o.id}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  checkedWinners.has(o.id) ? 'bg-accent/15 border border-accent/30' : 'hover:bg-surface-2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkedWinners.has(o.id)}
                  onChange={() => toggleWinner(o.id)}
                  className="accent-accent w-3.5 h-3.5 shrink-0"
                />
                <span className="text-sm text-white">{o.label}</span>
                {o.odds != null && (
                  <span className={`ml-auto text-xs font-mono shrink-0 ${o.odds > 0 ? 'text-win' : 'text-loss'}`}>
                    {o.odds > 0 ? `+${o.odds}` : o.odds}
                  </span>
                )}
              </label>
            ))}
          </div>
          {checkedWinners.size === 0 && (
            <p className="text-xs text-muted/50 italic">No winner selected — will record as Push</p>
          )}
        </div>
      )}

      {isSpreadType && (
        <div className="grid grid-cols-2 gap-3">
          <Input name="homeScore" label="Home Score" type="number" step="0.1"
            defaultValue={r?.home_score ?? ''} placeholder="optional" />
          <Input name="awayScore" label="Away Score" type="number" step="0.1"
            defaultValue={r?.away_score ?? ''} placeholder="optional" />
        </div>
      )}

      {r?.result_display && (
        <p className="text-xs text-muted">Display: {r.result_display}</p>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="sm" loading={loading}>Save Result</Button>
    </form>
  )
}

// ─── Slate game result row ────────────────────────────────────────────────────

function SlateGameResultRow({ game, now, prefill, bzId }: {
  game: SlateGame
  now: Date
  prefill?: { awayScore: number; homeScore: number; resultDisplay: string }
  bzId: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [localResult, setLocalResult] = useState(game.result)
  const [formKey, setFormKey] = useState(0)
  const r = localResult
  const status = getStatus(game.start_time_et, !!r, now)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(t)
  }, [saved])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    const result = await upsertSlateResult(fd)
    if (result.error) {
      setError(result.error)
    } else {
      const awayScore = Number(fd.get('awayScore'))
      const homeScore = Number(fd.get('homeScore'))
      setLocalResult({
        away_score: awayScore,
        home_score: homeScore,
        result_display: `${game.away_team} ${awayScore}, ${game.home_team} ${homeScore}`,
      })
      setSaved(true)
    }
    setLoading(false)
  }

  return (
    <form key={formKey} onSubmit={submit} className={`rounded-xl border bg-surface p-4 space-y-3 ${prefill ? 'border-accent/40' : 'border-border'}`}>
      <input type="hidden" name="slateGameId" value={game.id} />
      <input type="hidden" name="bzId" value={bzId} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-semibold text-white text-sm">
            {sportEmoji(game.sport_label)} {game.away_team} @ {game.home_team}
          </span>
          <span className="ml-2 text-xs text-muted">{game.sport_label}</span>
        </div>
        <div className="flex items-center gap-2">
          {prefill && <Badge variant="admin">API</Badge>}
          <Badge variant={statusBadge[status]}>{statusLabel[status]}</Badge>
        </div>
      </div>
      {saved && <p className="text-xs text-win">✓ Saved</p>}

      <div className="grid grid-cols-2 gap-3">
        <Input name="awayScore" label={`${game.away_team} Score`} type="number" step="0.1"
          defaultValue={prefill?.awayScore ?? r?.away_score ?? ''} required />
        <Input name="homeScore" label={`${game.home_team} Score`} type="number" step="0.1"
          defaultValue={prefill?.homeScore ?? r?.home_score ?? ''} required />
      </div>

      {r?.result_display && (
        <p className="text-xs text-muted">Display: {r.result_display}</p>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {confirmReset ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2">
          <span className="text-xs text-danger font-medium">Clear this result?</span>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="danger" loading={resetLoading} onClick={async () => {
              setResetLoading(true)
              const res = await deleteSlateResult(game.id, bzId)
              if (res.error) {
                setError(res.error)
              } else {
                setLocalResult(null)
                setFormKey(k => k + 1)
              }
              setConfirmReset(false)
              setResetLoading(false)
            }}>Clear</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button type="submit" size="sm" loading={loading}>Save Result</Button>
          {r && (
            <button type="button" onClick={() => setConfirmReset(true)}
              className="text-xs text-muted/40 hover:text-danger transition-colors">
              ↺ Reset result
            </button>
          )}
        </div>
      )}
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type StatusFilter = 'all' | GameStatus

export function ResultsForm({ events, slateGames, bzId }: {
  events: Event[]
  slateGames: SlateGame[]
  bzId: string
}) {
  const [typeTab, setTypeTab] = useState<'events' | 'slate'>('events')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchDone, setFetchDone] = useState(false)
  const [proposed, setProposed] = useState<ProposedSlateResult[]>([])
  const [notFound, setNotFound] = useState<NotFoundSlateGame[]>([])
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [confirmAllLoading, setConfirmAllLoading] = useState(false)

  const now = useMemo(() => new Date(), [])

  async function handleFetch() {
    setFetchLoading(true)
    setFetchError(null)
    setFetchDone(false)
    setProposed([])
    setNotFound([])
    setSkipped(new Set())
    const res = await fetchResultsFromAPI(bzId)
    if (res.error) setFetchError(res.error)
    else {
      setProposed(res.proposed)
      setNotFound(res.notFound)
      setFetchDone(true)
    }
    setFetchLoading(false)
  }

  async function handleConfirmAll() {
    setConfirmAllLoading(true)
    const toConfirm = proposed.filter(p => p.isCompleted && !skipped.has(p.slateGameId))
    for (const p of toConfirm) {
      const fd = new FormData()
      fd.set('slateGameId', p.slateGameId)
      fd.set('awayScore', String(p.awayScore))
      fd.set('homeScore', String(p.homeScore))
      fd.set('bzId', bzId)
      await upsertSlateResult(fd)
    }
    setProposed([])
    setNotFound([])
    setConfirmAllLoading(false)
  }

  function dismissGame(id: string) {
    setProposed(prev => prev.filter(p => p.slateGameId !== id))
    setNotFound(prev => prev.filter(p => p.slateGameId !== id))
  }

  function skipGame(id: string) {
    setSkipped(prev => new Set(prev).add(id))
    dismissGame(id)
  }

  const statusCounts = useMemo(() => {
    const items = typeTab === 'events' ? events : slateGames
    const counts: Record<StatusFilter, number> = { all: items.length, not_started: 0, in_progress: 0, complete: 0 }
    for (const item of items) {
      const s = getStatus(item.start_time_et, !!(item as any).result, now)
      counts[s]++
    }
    return counts
  }, [typeTab, events, slateGames, now])

  function filterByStatus<T extends { start_time_et: string | null; result?: any }>(items: T[]): T[] {
    if (statusFilter === 'all') return items
    return items.filter(item => getStatus(item.start_time_et, !!item.result, now) === statusFilter)
  }

  const filteredEvents = filterByStatus(events)
  const filteredSlate = filterByStatus(slateGames)

  const proposedById = Object.fromEntries(proposed.map(p => [p.slateGameId, p]))
  const notFoundIds = new Set(notFound.map(n => n.slateGameId))

  return (
    <div className="space-y-4">

      {/* Fetch from API — always visible */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" loading={fetchLoading} onClick={handleFetch}>
          ↓ Fetch Results from API
        </Button>
        {fetchError && <span className="text-xs text-danger">{fetchError}</span>}
      </div>

      {/* API results panel — shown after every fetch attempt */}
      {fetchDone && (
        <Card className="space-y-3 border-accent/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {(() => {
                const completed = proposed.filter(p => p.isCompleted).length
                const live = proposed.filter(p => !p.isCompleted).length
                const parts: string[] = []
                if (completed > 0) parts.push(`${completed} completed`)
                if (live > 0) parts.push(`${live} live/in-progress`)
                if (notFound.length > 0) parts.push(`${notFound.length} not found`)
                return `API Results — ${parts.length ? parts.join(', ') : 'all games already saved or none completed yet'}`
              })()}
            </h3>
            <div className="flex gap-2">
              {proposed.filter(p => p.isCompleted).length > 0 && (
                <Button size="sm" loading={confirmAllLoading} onClick={handleConfirmAll}>
                  Confirm All ({proposed.filter(p => p.isCompleted).length})
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setProposed([]); setNotFound([]); setFetchDone(false) }}>
                Dismiss
              </Button>
            </div>
          </div>

          {/* Proposed results */}
          {proposed.map(p => (
            <div key={p.slateGameId} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${p.isCompleted ? 'border-accent/30 bg-accent/5' : 'border-pending/40 bg-pending/5'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">
                    {p.awayTeam} {p.awayScore} · {p.homeTeam} {p.homeScore}
                  </span>
                  {!p.isCompleted && (
                    <Badge variant="pending">Live — game in progress</Badge>
                  )}
                </div>
                {!p.isCompleted && (
                  <div className="text-xs text-pending mt-0.5">Scores may change. Use Override to save current scores.</div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant={p.isCompleted ? 'primary' : 'secondary'} onClick={async () => {
                  const fd = new FormData()
                  fd.set('slateGameId', p.slateGameId)
                  fd.set('awayScore', String(p.awayScore))
                  fd.set('homeScore', String(p.homeScore))
                  fd.set('bzId', bzId)
                  await upsertSlateResult(fd)
                  dismissGame(p.slateGameId)
                }}>{p.isCompleted ? '✓ Confirm' : '⚠ Override'}</Button>
                <Button size="sm" variant="ghost" onClick={() => skipGame(p.slateGameId)}>Skip</Button>
              </div>
            </div>
          ))}

          {/* Not found games */}
          {notFound.map(g => (
            <div key={g.slateGameId} className="flex items-center gap-3 rounded-lg border border-accent-2/30 bg-accent-2/5 px-3 py-2.5">
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {g.awayTeam} @ {g.homeTeam}
                </div>
                <div className="text-xs text-accent-2 mt-0.5">
                  {g.reason === 'no_api_sport' && `${g.sportLabel} — no API sport mapping`}
                  {g.reason === 'no_match' && 'Not found in API — enter manually'}
                  {g.reason === 'not_completed' && 'Game not yet completed in API'}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => dismissGame(g.slateGameId)}>Dismiss</Button>
            </div>
          ))}
        </Card>
      )}

      {/* Type tabs */}
      <div className="flex gap-1">
        {(['events', 'slate'] as const).map(t => (
          <button key={t} onClick={() => { setTypeTab(t); setStatusFilter('all') }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${typeTab === t ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}>
            {t === 'events' ? `Events (${events.length})` : `Slate Games (${slateGames.length})`}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1">
        {(['all', 'not_started', 'in_progress', 'complete'] as StatusFilter[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}>
            {s === 'all' ? `All (${statusCounts.all})` : `${statusLabel[s]} (${statusCounts[s]})`}
          </button>
        ))}
      </div>

      {/* Events list */}
      {typeTab === 'events' && (
        <div className="space-y-3">
          {filteredEvents.map(e => <EventResultRow key={e.id} event={e} now={now} bzId={bzId} />)}
          {filteredEvents.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              No {statusFilter !== 'all' ? statusLabel[statusFilter].toLowerCase() + ' ' : ''}events.
            </p>
          )}
        </div>
      )}

      {/* Slate games list */}
      {typeTab === 'slate' && (
        <div className="space-y-3">
          {filteredSlate.map(g => (
            <SlateGameResultRow
              key={g.id}
              game={g}
              now={now}
              prefill={proposedById[g.id]}
              bzId={bzId}
            />
          ))}
          {filteredSlate.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              No {statusFilter !== 'all' ? statusLabel[statusFilter].toLowerCase() + ' ' : ''}slate games.
            </p>
          )}
          {/* Highlight not-found games that aren't in the filtered list */}
          {notFoundIds.size > 0 && notFound.some(g =>
            !filteredSlate.find(s => s.id === g.slateGameId)
          ) && (
            <p className="text-xs text-accent-2 text-center">
              {notFound.filter(g => !filteredSlate.find(s => s.id === g.slateGameId)).length} not-found game(s) are hidden by the status filter.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
