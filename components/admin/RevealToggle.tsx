'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toggleReveal } from '@/lib/actions/admin/betstravaganza'

export function RevealToggle({ bzId, revealed }: { bzId: string; revealed: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setLoading(true)
    setError(null)
    const result = await toggleReveal(bzId, !revealed)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        {revealed
          ? 'Everyone can see all pages (leaderboard, picks, draft, schedule).'
          : 'Everyone (including admin) sees only Slate + Admin. Toggle to reveal everything.'}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        onClick={handleToggle}
        loading={loading}
        size="sm"
        variant={revealed ? 'danger' : 'secondary'}
      >
        {revealed ? '🔒 Hide from Players' : '👁 Reveal to Players'}
      </Button>
    </div>
  )
}
