/**
 * Apply all pending migrations to the database.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
 *   npx tsx scripts/migrate.ts
 *
 * Or add DATABASE_URL to .env.local and run:
 *   npx tsx scripts/migrate.ts
 */
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { Client } from 'pg'

// Support loading from .env.local
const envPath = resolve(process.cwd(), '.env.local')
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && !key.startsWith('#') && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
} catch { /* .env.local not present */ }

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌  DATABASE_URL is not set.')
  console.error('    Add it to .env.local or pass it as an env var:')
  console.error('    DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"')
  process.exit(1)
}

const client = new Client({ connectionString: dbUrl })

async function run() {
  await client.connect()
  console.log('✓  Connected to database')

  // Ensure migrations tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const { rows: applied } = await client.query<{ filename: string }>(
    'SELECT filename FROM _migrations ORDER BY filename'
  )
  const appliedSet = new Set(applied.map(r => r.filename))

  const migrationsDir = resolve(process.cwd(), 'supabase/migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip  ${file} (already applied)`)
      continue
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    console.log(`  apply ${file} ...`)
    await client.query(sql)
    await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
    count++
  }

  if (count === 0) {
    console.log('✓  Nothing to apply — database is up to date')
  } else {
    console.log(`✓  Applied ${count} migration(s)`)
  }
}

run()
  .catch(err => { console.error('❌ ', err.message); process.exit(1) })
  .finally(() => client.end())
