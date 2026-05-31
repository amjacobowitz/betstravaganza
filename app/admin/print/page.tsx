import { redirect } from 'next/navigation'
import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { PrintPDFs } from '@/components/admin/PrintPDFs'

export default async function PrintPage() {
  const bz = await getActive()
  if (!bz) redirect('/admin/setup')

  const supabase = await createClient()
  const [events, { data: slateGames }] = await Promise.all([
    getEventsWithOptions(bz.id),
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('sort_order'),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Print</h1>
      <PrintPDFs
        bzName={bz.name}
        events={events as any}
        slateGames={slateGames ?? []}
      />
    </div>
  )
}
