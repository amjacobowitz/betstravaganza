import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { setUserAdmin } from '@/lib/actions/admin/users'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, name, team_name, email, is_admin, created_at')
    .order('name')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Users</h1>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border/50">
          {(users ?? []).map(user => (
            <div key={user.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{user.team_name}</span>
                  {user.is_admin && <Badge variant="required">ADMIN</Badge>}
                </div>
                <div className="text-xs text-muted">{user.name} · {user.email}</div>
              </div>

              <form action={async () => {
                'use server'
                await setUserAdmin(user.id, !user.is_admin)
              }}>
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    user.is_admin
                      ? 'bg-surface-2 text-muted hover:text-danger hover:bg-danger/10'
                      : 'bg-surface-2 text-muted hover:text-win hover:bg-win/10'
                  }`}
                >
                  {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                </button>
              </form>
            </div>
          ))}
          {(users ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-muted text-sm">No users yet.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
