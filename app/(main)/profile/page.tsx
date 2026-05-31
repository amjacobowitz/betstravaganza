import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/player/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, team_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-white">Your Profile</h1>
      <ProfileForm
        currentName={profile?.name ?? ''}
        currentTeamName={profile?.team_name ?? ''}
      />
    </div>
  )
}
