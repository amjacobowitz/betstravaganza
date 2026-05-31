import { redirect } from 'next/navigation'
import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { ResultsForm } from '@/components/admin/ResultsForm'

export default async function ResultsPage() {
  const bz = await getActive()
  if (!bz) redirect('/admin/setup')

  const supabase = await createClient()
  const rawEvents = await getEventsWithOptions(bz.id)
  const eventIds = rawEvents.map((e: any) => e.id)

  const [{ data: rawSlateGames }, { data: results }, { data: slateResults }] = await Promise.all([
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('sort_order'),
    eventIds.length > 0
      ? supabase.from('results').select('*').in('event_id', eventIds)
      : Promise.resolve({ data: [] }),
    supabase.from('slate_results').select('*'),
  ])

  const events = rawEvents.map((e: any) => ({
    ...e,
    result: results?.find((r: any) => r.event_id === e.id) ?? null,
  }))

  const slateGames = (rawSlateGames ?? []).map((g: any) => ({
    ...g,
    result: slateResults?.find((r: any) => r.slate_game_id === g.id) ?? null,
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Results</h1>
      <ResultsForm events={events} slateGames={slateGames} />
    </div>
  )
}
