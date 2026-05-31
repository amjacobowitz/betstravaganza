import { createClient } from '@/lib/supabase/server'

export async function getActive() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('betstravaganza')
    .select('*')
    .neq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function getById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('betstravaganza')
    .select('*')
    .eq('id', id)
    .single()
  return data
}
