'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { upsertResult, upsertSlateResult } from '@/lib/actions/admin/results'

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
  bet_options: BetOption[]
  result?: {
    winner_bet_option_id: string | null
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
  result?: {
    home_score: number
    away_score: number
    result_display: string
  } | null
}

function EventResultRow({ event }: { event: Event }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const r = event.result

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const result = await upsertResult(new FormData(e.currentTarget))
    if (result.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
  }

  const hasScores = event.bet_type !== 'odds' || event.category === 'optional'

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <input type="hidden" name="eventId" value={event.id} />
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-white text-sm">{event.name}</span>
          <span className="ml-2 text-xs text-muted">{event.sport} · {event.bet_type}</span>
        </div>
        {saved && <span className="text-xs text-win">✓ Saved</span>}
        {r && !saved && <span className="text-xs text-accent-2">Has result</span>}
      </div>

      {event.bet_options.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Winner</label>
          <select name="winnerBetOptionId"
            defaultValue={r?.winner_bet_option_id ?? ''}
            className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent">
            <option value="">— No winner / Push —</option>
            {event.bet_options.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input name="homeScore" label="Home Score" type="number" step="0.1"
          defaultValue={r?.home_score ?? ''} placeholder="optional" />
        <Input name="awayScore" label="Away Score" type="number" step="0.1"
          defaultValue={r?.away_score ?? ''} placeholder="optional" />
      </div>

      <Input name="resultDisplay" label="Result Display" required
        defaultValue={r?.result_display ?? ''}
        placeholder="e.g. Justify wins, 2:03.45" />

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="sm" loading={loading}>Save Result</Button>
    </form>
  )
}

function SlateGameResultRow({ game }: { game: SlateGame }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const r = game.result

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    const result = await upsertSlateResult(new FormData(e.currentTarget))
    if (result.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <input type="hidden" name="slateGameId" value={game.id} />
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-white text-sm">{game.away_team} @ {game.home_team}</span>
          <span className="ml-2 text-xs text-muted">{game.sport_label}</span>
        </div>
        {saved && <span className="text-xs text-win">✓ Saved</span>}
        {r && !saved && <span className="text-xs text-accent-2">Has result</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input name="awayScore" label={`${game.away_team} Score`} type="number" step="0.1"
          defaultValue={r?.away_score ?? ''} required />
        <Input name="homeScore" label={`${game.home_team} Score`} type="number" step="0.1"
          defaultValue={r?.home_score ?? ''} required />
      </div>

      <Input name="resultDisplay" label="Result Display"
        defaultValue={r?.result_display ?? ''}
        placeholder={`${game.away_team} 5, ${game.home_team} 3`} />

      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="submit" size="sm" loading={loading}>Save Result</Button>
    </form>
  )
}

export function ResultsForm({ events, slateGames }: {
  events: Event[]
  slateGames: SlateGame[]
}) {
  const [tab, setTab] = useState<'events' | 'slate'>('events')

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(['events', 'slate'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'}`}>
            {t === 'events' ? `Events (${events.length})` : `Slate Games (${slateGames.length})`}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="space-y-3">
          {events.map(e => <EventResultRow key={e.id} event={e} />)}
          {events.length === 0 && <p className="text-muted text-sm text-center py-8">No events yet.</p>}
        </div>
      )}

      {tab === 'slate' && (
        <div className="space-y-3">
          {slateGames.map(g => <SlateGameResultRow key={g.id} game={g} />)}
          {slateGames.length === 0 && <p className="text-muted text-sm text-center py-8">No slate games yet.</p>}
        </div>
      )}
    </div>
  )
}
