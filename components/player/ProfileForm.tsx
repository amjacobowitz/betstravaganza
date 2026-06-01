'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { updateProfile } from '@/lib/actions/player/profile'
import { createClient } from '@/lib/supabase/client'

interface ProfileFormProps {
  name: string
  teamName: string
  phone: string
  nickname: string
  birdImageUrl: string | null
  birdPlural: string
}

export function ProfileForm({ name, teamName, phone, nickname, birdImageUrl, birdPlural }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwLoading(true)
    const { error } = await createClient().auth.updateUser({ password: newPassword })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
  }

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
      {/* Bird photo */}
      {birdImageUrl && (
        <div className="mb-4 overflow-hidden rounded-xl border border-border/50">
          <img
            src={birdImageUrl}
            alt={birdPlural}
            className="w-full h-48 object-cover"
          />
          <div className="px-3 py-2 bg-surface-2/60 text-sm font-semibold text-white text-center">
            {birdPlural}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Read-only fields */}
        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">Name</label>
          <div className="rounded-lg border border-border/50 bg-surface-2/40 px-3 py-2 text-sm text-white/60">
            {name}
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted">Team</label>
          <div className="rounded-lg border border-border/50 bg-surface-2/40 px-3 py-2 text-sm text-white/60">
            {teamName}
          </div>
        </div>
        {phone && (
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted">Phone</label>
            <div className="rounded-lg border border-border/50 bg-surface-2/40 px-3 py-2 text-sm text-white/60">
              {phone}
            </div>
          </div>
        )}

        {/* Editable: team motto */}
        <Input
          name="nickname"
          label="Team Motto"
          defaultValue={nickname}
          placeholder="e.g. No mercy, Built different..."
        />

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-accent">Team motto saved.</p>}
        <Button type="submit" loading={loading} className="w-full">
          Save Motto
        </Button>
      </form>

      <hr className="border-border/30 my-4" />

      <form onSubmit={handlePasswordChange} className="space-y-4">
        <h3 className="text-sm font-semibold text-white">Change Password</h3>
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {pwError && <p className="text-sm text-danger">{pwError}</p>}
        {pwSuccess && <p className="text-sm text-accent">Password updated.</p>}
        <Button type="submit" variant="secondary" loading={pwLoading} className="w-full">
          Update Password
        </Button>
      </form>
    </Card>
  )
}
