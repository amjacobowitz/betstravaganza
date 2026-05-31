'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateBetstravaganzaDates } from '@/lib/actions/admin/betstravaganza'
import { toDatetimeLocalET, etDatetimeLocalToISO } from '@/lib/utils/datetime'

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
    const fd = new FormData(e.currentTarget)
    for (const field of ['startDatetime', 'endDatetime']) {
      const raw = fd.get(field) as string | null
      if (raw) fd.set(field, etDatetimeLocalToISO(raw))
    }
    const result = await updateBetstravaganzaDates(bzId, fd)
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
          defaultValue={toDatetimeLocalET(startDatetime)}
        />
        <Input
          name="endDatetime"
          label="Event End"
          type="datetime-local"
          defaultValue={toDatetimeLocalET(endDatetime)}
        />
      </div>
      <p className="text-xs text-muted">Slate picks are locked at Event Start. Times are Eastern (ET).</p>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={loading}>Save Dates</Button>
        {saved && <span className="text-xs text-win">✓ Saved</span>}
      </div>
    </form>
  )
}
