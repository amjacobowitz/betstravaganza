import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/player/ProfileForm'
import { getBird } from '@/lib/utils/birds'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, team_name, phone, nickname')
    .eq('id', user.id)
    .single()

  const bird = getBird(profile?.team_name)

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold text-white">Your Profile</h1>
      <ProfileForm
        name={profile?.name ?? ''}
        teamName={profile?.team_name ?? ''}
        phone={profile?.phone ?? ''}
        nickname={profile?.nickname ?? ''}
        birdImageUrl={bird?.imageUrl ?? null}
        birdPlural={bird?.plural ?? profile?.team_name ?? ''}
      />
    </div>
  )
}
