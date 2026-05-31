import { redirect } from 'next/navigation'
import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { EventsManager } from '@/components/admin/EventsManager'

export default async function EventsPage() {
  const bz = await getActive()
  if (!bz) redirect('/admin/setup')

  const [events, supabase] = await Promise.all([
    getEventsWithOptions(bz.id),
    createClient(),
  ])

  const { data: slateGames } = await supabase
    .from('slate_games')
    .select('*')
    .eq('betstravaganza_id', bz.id)
    .order('sort_order')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Events & Bets</h1>
      <EventsManager
        betstravaganzaId={bz.id}
        initialEvents={events as any}
        initialSlateGames={slateGames ?? []}
      />
    </div>
  )
}
