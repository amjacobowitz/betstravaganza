/**
 * Delete all data from all content tables (schema is preserved).
 * Uses the service-role key — no DB password required.
 *
 * Usage:
 *   npx tsx scripts/clear-db.ts
 *
 * Env required (reads from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Auth users must be deleted via the admin API — list and delete each one
async function clearAuthUsers() {
  let page = 1
  let deleted = 0
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw error
    if (!data.users.length) break
    for (const u of data.users) {
      await admin.auth.admin.deleteUser(u.id)
      deleted++
    }
    if (data.users.length < 50) break
    page++
  }
  return deleted
}

async function run() {
  console.log('Clearing all data (schema preserved)...\n')

  // Delete leaf tables first, then parents (cascade handles children but being explicit)
  const tables = [
    'draft_picks',
    'slate_picks',
    'slate_results',
    'results',
    'bet_options',
    'events',
    'slate_games',
    'betstravaganza',
    'users',           // public profile table
  ]

  for (const table of tables) {
    // Use a filter that always matches all rows (id column exists on every table)
    const { error, count } = await admin.from(table).delete().gte('created_at', '2000-01-01').select('id', { count: 'exact', head: true })
    if (error) {
      console.error(`  ❌  ${table}: ${error.message}`)
    } else {
      console.log(`  ✓  ${table} cleared`)
    }
  }

  // Clear auth.users (Supabase auth — separate from public.users)
  process.stdout.write('  Deleting auth users...')
  const deleted = await clearAuthUsers()
  console.log(` ✓  ${deleted} auth user(s) deleted`)

  console.log('\n✓  Database cleared.')
}

run().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
