'use client'

import { useRouter } from 'next/navigation'

interface Props {
  users: { id: string; name: string; team_name: string }[]
  currentUserId: string
  selectedUserId: string | null
}

export function TeamSelector({ users, currentUserId, selectedUserId }: Props) {
  const router = useRouter()
  return (
    <select
      value={selectedUserId ?? ''}
      onChange={e => {
        const id = e.target.value
        router.push(id ? `/picks?user=${id}` : '/picks?tab=others')
      }}
      className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="">— Select a team —</option>
      {users
        .filter(u => u.id !== currentUserId)
        .map(u => (
          <option key={u.id} value={u.id}>
            {u.team_name ? `${u.team_name} (${u.name})` : u.name}
          </option>
        ))}
    </select>
  )
}
