import { createClient } from '@/lib/supabase/server'

export async function getDraftState(betstravaganzaId: string) {
  const supabase = await createClient()

  const [{ data: picks }, { data: users }] = await Promise.all([
    supabase
      .from('draft_picks')
      .select('*, bet_options(id, label, odds, event_id, events(id, name, sport, category, bet_type))')
      .eq('betstravaganza_id', betstravaganzaId)
      .order('pick_index'),
    supabase
      .from('users')
      .select('id, name, team_name'),
  ])

  return { picks: picks ?? [], users: users ?? [] }
}

export async function getPicksByUser(betstravaganzaId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('draft_picks')
    .select('*, bet_options(id, label, odds, event_id, events(id, name, sport, category, bet_type))')
    .eq('betstravaganza_id', betstravaganzaId)
    .eq('user_id', userId)
    .order('pick_index')
  return data ?? []
}
