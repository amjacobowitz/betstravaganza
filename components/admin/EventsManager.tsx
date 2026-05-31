'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import {
  upsertEvent, deleteEvent,
  upsertBetOption, deleteBetOption,
  upsertSlateGame,
} from '@/lib/actions/admin/events'

interface BetOption {
  id: string
  label: string
  odds: number | null
  odds_source: string
  max_drafts: number
}

interface Event {
  id: string
  name: string
  sport: string
  category: string
  bet_type: string
  start_time_et: string | null
  streaming_info: string | null
  notes: string | null
  sort_order: number
  bet_options: BetOption[]
}

interface SlateGame {
  id: string
  sport_label: string
  home_team: string
  away_team: string
  start_time_et: string
  spread: number | null
  notes: string | null
  sort_order: number
}

interface Props {
  betstravaganzaId: string
  initialEvents: Event[]
  initialSlateGames: SlateGame[]
}

function formatDateTimeLocal(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

function EventForm({ bzId, event, onDone }: {
  bzId: string
  event?: Event
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('betstravaganzaId', bzId)
    if (event) fd.set('id', event.id)
    const result = await upsertEvent(fd)
    if (result.error) { setError(result.error); setLoading(false) }
    else { onDone() }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4 bg-surface-2 rounded-lg border border-border">
      <div className="grid grid-cols-2 gap-3">
        <Input name="name" label="Name" defaultValue={event?.name} required />
        <Input name="sport" label="Sport" defaultValue={event?.sport} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Category</label>
          <select name="category" defaultValue={event?.category ?? 'optional'}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted">Bet Type</label>
          <select name="betType" defaultValue={event?.bet_type ?? 'odds'}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="odds">Odds</option>
            <option value="spread">Spread</option>
            <option value="no_odds">No Odds</option>
          </select>
        </div>
        <Input name="sortOrder" label="Sort Order" type="number" defaultValue={event?.sort_order ?? 0} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input name="startTimeEt" label="Start Time (ET)" type="datetime-local"
          defaultValue={formatDateTimeLocal(event?.start_time_et ?? null)} />
        <Input name="streamingInfo" label="Streaming" defaultValue={event?.streaming_info ?? ''} />
      </div>
      <Input name="notes" label="Notes" defaultValue={event?.notes ?? ''} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>{event ? 'Save' : 'Add Event'}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

function BetOptionForm({ eventId, option, onDone }: {
  eventId: string
  option?: BetOption
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('eventId', eventId)
    if (option) fd.set('id', option.id)
    const result = await upsertBetOption(fd)
    if (result.error) { setError(result.error); setLoading(false) }
    else { onDone() }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 p-3 bg-surface rounded-lg border border-border/50">
      <Input name="label" label="Label" defaultValue={option?.label} required className="w-40" />
      <Input name="odds" label="Odds" type="number" defaultValue={option?.odds ?? ''} placeholder="null" className="w-24" />
      <Input name="maxDrafts" label="Max Drafts" type="number" defaultValue={option?.max_drafts ?? 1} min={1} className="w-24" />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-muted">Source</label>
        <select name="oddsSource" defaultValue={option?.odds_source ?? 'manual'}
          className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent">
          <option value="manual">Manual</option>
          <option value="auto">Auto</option>
          <option value="auto_confirmed">Auto ✓</option>
        </select>
      </div>
      {error && <p className="text-xs text-danger w-full">{error}</p>}
      <div className="flex gap-2 items-end pb-0.5">
        <Button type="submit" size="sm" loading={loading}>{option ? 'Save' : 'Add'}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>✕</Button>
      </div>
    </form>
  )
}

function SlateGameForm({ bzId, game, onDone }: {
  bzId: string
  game?: SlateGame
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    fd.set('betstravaganzaId', bzId)
    if (game) fd.set('id', game.id)
    const result = await upsertSlateGame(fd)
    if (result.error) { setError(result.error); setLoading(false) }
    else { onDone() }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4 bg-surface-2 rounded-lg border border-border">
      <div className="grid grid-cols-3 gap-3">
        <Input name="sportLabel" label="Sport" defaultValue={game?.sport_label ?? 'MLB'} required />
        <Input name="awayTeam" label="Away Team" defaultValue={game?.away_team} required />
        <Input name="homeTeam" label="Home Team" defaultValue={game?.home_team} required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input name="startTimeEt" label="Start Time (ET)" type="datetime-local"
          defaultValue={formatDateTimeLocal(game?.start_time_et ?? null)} required />
        <Input name="spread" label="Spread (home)" type="number" step="0.5"
          defaultValue={game?.spread ?? ''} placeholder="e.g. -1.5" />
        <Input name="sortOrder" label="Sort Order" type="number" defaultValue={game?.sort_order ?? 0} />
      </div>
      <Input name="notes" label="Notes / Streaming" defaultValue={game?.notes ?? ''} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={loading}>{game ? 'Save' : 'Add Game'}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  )
}

export function EventsManager({ betstravaganzaId, initialEvents, initialSlateGames }: Props) {
  const [tab, setTab] = useState<'events' | 'slate'>('events')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [addingSlateGame, setAddingSlateGame] = useState(false)
  const [editingSlateGameId, setEditingSlateGameId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Optimistically reload via router — Next.js revalidatePath triggers a refresh
  function reload() {
    window.location.reload()
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Delete this event and all its bet options?')) return
    setDeletingId(id)
    const result = await deleteEvent(id)
    if (result.error) setError(result.error)
    else reload()
    setDeletingId(null)
  }

  async function handleDeleteOption(id: string) {
    if (!confirm('Delete this bet option?')) return
    setDeletingId(id)
    const result = await deleteBetOption(id)
    if (result.error) setError(result.error)
    else reload()
    setDeletingId(null)
  }

  const events = initialEvents
  const slateGames = initialSlateGames

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

      {/* Tab switcher */}
      <div className="flex gap-1">
        {(['events', 'slate'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}>
            {t === 'events' ? 'Events & Bets' : 'Slate Games'}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Event header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{event.name}</span>
                    <Badge variant={event.category === 'required' ? 'required' : 'default'}>
                      {event.category.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted">{event.sport} · {event.bet_type.replace('_', ' ')}</span>
                    <span className="text-xs text-muted">{event.bet_options.length} options</span>
                  </div>
                </button>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditingEventId(event.id)
                    setExpandedEventId(event.id)
                  }}>Edit</Button>
                  <Button variant="danger" size="sm"
                    loading={deletingId === event.id}
                    onClick={() => handleDeleteEvent(event.id)}>Del</Button>
                </div>
              </div>

              {/* Edit form */}
              {editingEventId === event.id && (
                <div className="px-4 pb-4">
                  <EventForm bzId={betstravaganzaId} event={event} onDone={() => { setEditingEventId(null); reload() }} />
                </div>
              )}

              {/* Bet options */}
              {expandedEventId === event.id && editingEventId !== event.id && (
                <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-2">
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Bet Options</p>
                  {event.bet_options.map(opt => (
                    <div key={opt.id}>
                      {editingOptionId === opt.id ? (
                        <BetOptionForm eventId={event.id} option={opt} onDone={() => { setEditingOptionId(null); reload() }} />
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-surface-2/50 border border-border/30">
                          <div className="flex-1 text-sm">
                            <span className="text-white font-medium">{opt.label}</span>
                            <span className="ml-3 font-mono text-xs text-accent-2">
                              {opt.odds !== null ? (opt.odds > 0 ? `+${opt.odds}` : `${opt.odds}`) : 'no odds'}
                            </span>
                            {opt.max_drafts > 1 && (
                              <span className="ml-2 text-xs text-muted">max {opt.max_drafts}</span>
                            )}
                            {opt.odds_source === 'auto' && (
                              <span className="ml-2 text-xs text-clash">auto</span>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setEditingOptionId(opt.id)}>Edit</Button>
                          <Button variant="danger" size="sm"
                            loading={deletingId === opt.id}
                            onClick={() => handleDeleteOption(opt.id)}>Del</Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {addingOptionFor === event.id ? (
                    <BetOptionForm eventId={event.id} onDone={() => { setAddingOptionFor(null); reload() }} />
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setAddingOptionFor(event.id)}>
                      + Add Option
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}

          {addingEvent ? (
            <EventForm bzId={betstravaganzaId} onDone={() => { setAddingEvent(false); reload() }} />
          ) : (
            <Button variant="secondary" onClick={() => setAddingEvent(true)} className="w-full">
              + Add Event
            </Button>
          )}
        </div>
      )}

      {tab === 'slate' && (
        <div className="space-y-2">
          {slateGames.map(game => (
            <div key={game.id} className="rounded-xl border border-border bg-surface overflow-hidden">
              {editingSlateGameId === game.id ? (
                <div className="p-4">
                  <SlateGameForm bzId={betstravaganzaId} game={game} onDone={() => { setEditingSlateGameId(null); reload() }} />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{game.away_team} @ {game.home_team}</div>
                    <div className="text-xs text-muted">
                      {game.sport_label}
                      {game.spread !== null && ` · Spread: ${game.spread > 0 ? '+' : ''}${game.spread}`}
                      {game.notes && ` · ${game.notes}`}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditingSlateGameId(game.id)}>Edit</Button>
                </div>
              )}
            </div>
          ))}

          {addingSlateGame ? (
            <SlateGameForm bzId={betstravaganzaId} onDone={() => { setAddingSlateGame(false); reload() }} />
          ) : (
            <Button variant="secondary" onClick={() => setAddingSlateGame(true)} className="w-full">
              + Add Slate Game
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
