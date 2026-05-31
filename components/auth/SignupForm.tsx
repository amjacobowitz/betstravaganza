'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { signUp } from '@/lib/actions/auth'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await signUp(new FormData(e.currentTarget))
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Name" name="name" type="text" required placeholder="Your real name" autoComplete="name" />
      <Input label="Team Name" name="teamName" type="text" required placeholder="Your squad name" />
      <Input label="Phone Number" name="phone" type="tel" required autoComplete="tel" placeholder="(248) 555-0100" />
      <Input label="Password" name="password" type="password" required minLength={4} autoComplete="new-password" />
      {error && <p className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
        Create Account
      </Button>
    </form>
  )
}
