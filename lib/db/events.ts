import { createClient } from '@/lib/supabase/server'

export async function getEventsWithOptions(betstravaganzaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('*, bet_options(*)')
    .eq('betstravaganza_id', betstravaganzaId)
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

export async function getRequiredEvents(betstravaganzaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('id, name, sport')
    .eq('betstravaganza_id', betstravaganzaId)
    .eq('category', 'required')
    .eq('is_active', true)
  return data ?? []
}
