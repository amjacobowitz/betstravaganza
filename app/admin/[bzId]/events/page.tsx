import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { EventsManager } from '@/components/admin/EventsManager'

export default async function EventsPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const [events, supabase] = await Promise.all([
    getEventsWithOptions(bz.id),
    createClient(),
  ])
  const { data: slateGames } = await supabase
    .from('slate_games')
    .select('*')
    .eq('betstravaganza_id', bz.id)
    .order('start_time_et')

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Events & Bets</h2>
      <EventsManager
        betstravaganzaId={bz.id}
        initialEvents={events as any}
        initialSlateGames={slateGames ?? []}
      />
    </div>
  )
}
