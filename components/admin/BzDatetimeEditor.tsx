'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateBetstravaganzaDates } from '@/lib/actions/admin/betstravaganza'

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  // datetime-local needs "YYYY-MM-DDTHH:MM"
  return new Date(iso).toISOString().slice(0, 16)
}

export function BzDatetimeEditor({
  bzId,
  startDatetime,
  endDatetime,
}: {
  bzId: string
  startDatetime: string | null
  endDatetime: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    setError(null)
    const result = await updateBetstravaganzaDates(bzId, new FormData(e.currentTarget))
    if (result.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="startDatetime"
          label="Event Start (slate locks)"
          type="datetime-local"
          defaultValue={toDatetimeLocal(startDatetime)}
        />
        <Input
          name="endDatetime"
          label="Event End"
          type="datetime-local"
          defaultValue={toDatetimeLocal(endDatetime)}
        />
      </div>
      <p className="text-xs text-muted">Slate picks are locked at Event Start. Times are in your local timezone.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={loading}>Save Dates</Button>
        {saved && <span className="text-xs text-win">✓ Saved</span>}
      </div>
    </form>
  )
}
