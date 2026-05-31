'use client'

import { useState } from 'react'
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
}

interface Pick {
  teamPicked: 'home' | 'away' | null
  confidenceRank: number
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function SlatePicksForm({ betstravaganzaId, slateGames, existingPicks }: Props) {
  const initialPicks: Record<string, Pick> = {}
  for (const ep of existingPicks) {
    initialPicks[ep.slateGameId] = { teamPicked: ep.teamPicked, confidenceRank: ep.confidenceRank }
  }
  for (const g of slateGames) {
    if (!initialPicks[g.id]) {
      initialPicks[g.id] = { teamPicked: null, confidenceRank: 0 }
    }
  }

  const [picks, setPicks] = useState<Record<string, Pick>>(initialPicks)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(existingPicks.length === slateGames.length)

  const n = slateGames.length
  const usedRanks = Object.values(picks).map(p => p.confidenceRank).filter(r => r > 0)
  const allPicked = Object.values(picks).every(p => p.teamPicked !== null)
  const allRanked = usedRanks.length === n && new Set(usedRanks).size === n
  const canSubmit = allPicked && allRanked

  function setTeam(gameId: string, team: 'home' | 'away') {
    setPicks(prev => ({ ...prev, [gameId]: { ...prev[gameId], teamPicked: team } }))
    setSubmitted(false)
  }

  function setRank(gameId: string, rank: number) {
    // If rank is taken by another game, swap
    const currentHolder = Object.entries(picks).find(([id, p]) => p.confidenceRank === rank && id !== gameId)
    const prevRank = picks[gameId]?.confidenceRank ?? 0
    setPicks(prev => {
      const next = { ...prev }
      if (currentHolder) {
        next[currentHolder[0]] = { ...next[currentHolder[0]], confidenceRank: prevRank }
      }
      next[gameId] = { ...next[gameId], confidenceRank: rank }
      return next
    })
    setSubmitted(false)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)

    const result = await submitSlatePicks(
      betstravaganzaId,
      slateGames.map(g => ({
        slateGameId: g.id,
        teamPicked: picks[g.id].teamPicked as 'home' | 'away',
        confidenceRank: picks[g.id].confidenceRank,
      }))
    )

    if (result.error) setError(result.error)
    else setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        Pick a winner for each game and assign a confidence rank (1 = least confident, {n} = most confident).
        Higher confidence = more points if correct.
      </div>

      <div className="space-y-2">
        {slateGames.map(game => {
          const pick = picks[game.id]
          return (
            <div
              key={game.id}
              className="rounded-xl border border-border bg-surface p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {game.away_team} @ {game.home_team}
                  </div>
                  <div className="text-xs text-muted">
                    {game.sport_label} · {formatTime(game.start_time_et)}
                    {game.spread !== null && ` · Spread: ${game.spread > 0 ? '+' : ''}${game.spread}`}
                    {game.notes && ` · ${game.notes}`}
                  </div>
                </div>

                {/* Confidence rank selector */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <label className="text-xs text-muted">Rank</label>
                  <select
                    value={pick?.confidenceRank || ''}
                    onChange={e => setRank(game.id, Number(e.target.value))}
                    className="h-8 w-16 rounded-lg border border-border bg-surface-2 px-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="">—</option>
                    {Array.from({ length: n }, (_, i) => i + 1).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Team picker */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTeam(game.id, 'away')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    pick?.teamPicked === 'away'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-2 text-muted hover:text-white hover:border-border/80'
                  }`}
                >
                  {game.away_team}
                  <span className="ml-1 text-xs opacity-60">away</span>
                </button>
                <button
                  onClick={() => setTeam(game.id, 'home')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    pick?.teamPicked === 'home'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-2 text-muted hover:text-white hover:border-border/80'
                  }`}
                >
                  {game.home_team}
                  <span className="ml-1 text-xs opacity-60">home</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {!canSubmit && !submitted && (
        <div className="text-xs text-muted">
          {!allPicked && 'Pick a team for every game. '}
          {!allRanked && 'Assign a unique rank to every game.'}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!canSubmit}
        className="w-full"
      >
        {submitted ? '✓ Picks Submitted — Update' : 'Submit Slate Picks'}
      </Button>
    </div>
  )
}
