import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

export async function getUser() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function checkRateLimit(supabase, userId, route, limit, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString()
  const { count } = await supabase.from('api_usage').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('route', route).gte('created_at', since)
  if (count >= limit) return false
  await supabase.from('api_usage').insert({ user_id: userId, route })
  return true
}
