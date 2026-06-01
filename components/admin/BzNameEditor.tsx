'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { renameBetstravaganza } from '@/lib/actions/admin/betstravaganza'

export function BzNameEditor({ bzId, initialName }: { bzId: string; initialName: string }) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    setError(null)
    const name = (new FormData(e.currentTarget).get('name') as string) ?? ''
    const result = await renameBetstravaganza(bzId, name)
    if (result.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input name="name" label="Name" defaultValue={initialName} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" loading={loading}>Save Name</Button>
        {saved && <span className="text-xs text-win">✓ Saved</span>}
      </div>
    </form>
  )
}
