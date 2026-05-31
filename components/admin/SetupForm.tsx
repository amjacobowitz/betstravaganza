'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createBetstravaganza } from '@/lib/actions/admin/betstravaganza'

export function SetupForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await createBetstravaganza(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <Input name="name" label="Event Name" placeholder="Betstravaganza 2026" required />
      <div className="grid grid-cols-2 gap-4">
        <Input name="playerCount" label="Players" type="number" defaultValue={11} min={2} required />
        <Input name="roundCount" label="Rounds" type="number" defaultValue={11} min={1} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input name="stakeAmount" label="Stake ($)" type="number" defaultValue={100} min={1} required />
        <Input name="startingBankroll" label="Starting Bankroll ($)" type="number" defaultValue={1100} min={1} required />
      </div>
      <Input name="confidenceMultiplier" label="Slate $/Rank" type="number" defaultValue={3} min={1} required />
      <div className="grid grid-cols-2 gap-4">
        <Input name="startDatetime" label="Event Start (slate locks)" type="datetime-local" />
        <Input name="endDatetime" label="Event End" type="datetime-local" />
      </div>
      <p className="text-xs text-muted -mt-2">Times are in your local timezone. Slate picks are locked at Event Start.</p>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" loading={loading} className="w-full">
        Create Betstravaganza
      </Button>
    </form>
  )
}
