import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { PrintPDFs } from '@/components/admin/PrintPDFs'

export default async function PrintPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const supabase = await createClient()
  const [events, { data: slateGames }, { data: draftPicks }, { data: users }] = await Promise.all([
    getEventsWithOptions(bz.id),
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('draft_picks').select('bet_option_id, user_id').eq('betstravaganza_id', bz.id),
    supabase.from('users').select('id, name, team_name').order('name'),
  ])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Print</h2>
      <PrintPDFs
        bzName={bz.name}
        events={events as any}
        slateGames={slateGames ?? []}
        draftPicks={draftPicks ?? []}
        users={users ?? []}
      />
    </div>
  )
}
