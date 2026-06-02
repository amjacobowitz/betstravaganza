'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  users: { id: string; name: string; team_name: string }[]
  currentUserId: string
  viewUserId: string
  vsUserId: string | null
}

export function VsSelector({ users, currentUserId, viewUserId, vsUserId }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  function buildUrl(vsId: string) {
    const params = new URLSearchParams(sp.toString())
    if (vsId) {
      params.set('vs', vsId)
    } else {
      params.delete('vs')
    }
    return `/picks?${params.toString()}`
  }

  return (
    <select
      value={vsUserId ?? ''}
      onChange={e => router.push(buildUrl(e.target.value))}
      className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="">Compare vs…</option>
      {users
        .filter(u => u.id !== currentUserId && u.id !== viewUserId)
        .map(u => (
          <option key={u.id} value={u.id}>
            {u.team_name ? `${u.team_name} (${u.name})` : u.name}
          </option>
        ))}
    </select>
  )
}
