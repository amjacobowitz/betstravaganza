'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { createBonus } from '@/lib/actions/admin/bonuses'

interface User {
  id: string
  name: string
  team_name: string | null
}

export function BonusForm({
  betstravaganzaId,
  users,
}: {
  betstravaganzaId: string
  users: User[]
}) {
  const [userId, setUserId] = useState('')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !title.trim() || !amount) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('betstravaganzaId', betstravaganzaId)
    fd.set('userId', userId)
    fd.set('title', title.trim())
    fd.set('amount', amount)

    const result = await createBonus(fd)
    if (result.error) {
      setError(result.error)
    } else {
      setUserId('')
      setTitle('')
      setAmount('')
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-muted mb-1">Player</label>
          <select
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="">Select player…</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.team_name ?? u.name} {u.team_name && u.team_name !== u.name ? `(${u.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Side bet winner"
            required
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="50"
            min="0"
            step="1"
            required
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}
      {success && (
        <p className="text-xs text-win">Bonus awarded!</p>
      )}

      <Button type="submit" loading={loading} disabled={!userId || !title.trim() || !amount}>
        Award Bonus
      </Button>
    </form>
  )
}
