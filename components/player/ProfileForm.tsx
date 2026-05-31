'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { updateProfile } from '@/lib/actions/player/profile'

interface ProfileFormProps {
  currentName: string
  currentTeamName: string
}

export function ProfileForm({ currentName, currentTeamName }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    const result = await updateProfile(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          name="name"
          label="Your Name"
          defaultValue={currentName}
          placeholder="Jane Smith"
          required
        />
        <Input
          name="teamName"
          label="Team Name"
          defaultValue={currentTeamName}
          placeholder="Team Chaos"
          required
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-accent">Profile updated.</p>}
        <Button type="submit" loading={loading} className="w-full">
          Save Changes
        </Button>
      </form>
    </Card>
  )
}
