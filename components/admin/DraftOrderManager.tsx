'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { updateDraftOrder, updateStatus } from '@/lib/actions/admin/betstravaganza'

interface User {
  id: string
  name: string
  team_name: string
}

interface Props {
  betstravaganzaId: string
  allUsers: User[]
  currentOrder: string[]
  status: string
}

export function DraftOrderManager({ betstravaganzaId, allUsers, currentOrder, status }: Props) {
  const initialOrder = currentOrder.length > 0
    ? currentOrder.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as User[]
    : allUsers

  const [order, setOrder] = useState<User[]>(initialOrder)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function move(index: number, direction: -1 | 1) {
    const next = [...order]
    const swap = index + direction
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setOrder(next)
    setSaved(false)
  }

  function randomize() {
    const shuffled = [...order]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setOrder(shuffled)
    setSaved(false)
  }

  async function save() {
    setLoading(true)
    setError(null)
    const result = await updateDraftOrder(betstravaganzaId, order.map(u => u.id))
    if (result.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
  }

  async function handleStatus(s: 'setup' | 'draft' | 'active' | 'complete') {
    setLoading(true)
    const result = await updateStatus(betstravaganzaId, s)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" onClick={randomize} disabled={loading}>
          🎲 Randomize
        </Button>
        <Button size="sm" onClick={save} loading={loading}>
          {saved ? '✓ Saved' : 'Save Order'}
        </Button>
      </div>

      <ol className="space-y-1">
        {order.map((u, i) => (
          <li key={u.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <span className="w-6 text-center text-xs font-mono text-muted font-bold">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">{u.team_name}</div>
              <div className="text-xs text-muted">{u.name}</div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0 || loading}
                className="h-7 w-7 rounded text-muted hover:text-white disabled:opacity-30 text-sm"
              >
                ▲
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1 || loading}
                className="h-7 w-7 rounded text-muted hover:text-white disabled:opacity-30 text-sm"
              >
                ▼
              </button>
            </div>
          </li>
        ))}
      </ol>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="pt-2 border-t border-border">
        <p className="text-xs text-muted mb-2 uppercase tracking-wider font-semibold">Status</p>
        <div className="flex flex-wrap gap-2">
          {(['setup', 'draft', 'active', 'complete'] as const).map(s => (
            <Button
              key={s}
              variant={status === s ? 'primary' : 'secondary'}
              size="sm"
              disabled={status === s || loading}
              onClick={() => handleStatus(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
