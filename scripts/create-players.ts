/**
 * Creates all player accounts (or resets passwords for existing ones).
 * Run: npx tsx scripts/create-players.ts
 *
 * Output: credentials for each player — text them their phone + password.
 */

import { createClient } from '@supabase/supabase-js'

// Dev (default): reads from .env.local SUPABASE_SECRET_KEY
// Prod: SUPABASE_URL=https://ubsizeecirrmtjtjztho.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/create-players.ts
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://hltbqkbvfjhjzestrlse.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? ''
if (!SERVICE_ROLE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return `${normalized}@betstravaganza.app`
}

// password is what you'll text each person. Default = last 4 digits of phone + "Betz".
// Change any individual password here before running.
const PLAYERS: { name: string; teamName: string; phone: string; password: string; isAdmin?: boolean }[] = [
  { name: 'Aaron',  teamName: 'American Robins',      phone: '2488088695', password: '8695bets', isAdmin: true  },
  { name: 'PJ',     teamName: "Kirtland's Warblers",  phone: '2489613672', password: '3672bets', isAdmin: true  },
  { name: 'Marco',  teamName: 'Sandhill Cranes',       phone: '2484967696', password: '7696bets', isAdmin: true  },
  { name: 'Jeremy', teamName: 'Tufted Titmice',        phone: '2484640812', password: '0812bets', isAdmin: true  },
  { name: 'Nick',   teamName: 'Northern Cardinals',    phone: '2482254493', password: '4493bets'               },
  { name: 'David',  teamName: 'Red-tailed Hawks',      phone: '2487667261', password: '7261bets'               },
  { name: 'Billy',  teamName: 'Baltimore Orioles',     phone: '3042668895', password: '8895bets'               },
  { name: 'Jeff',   teamName: 'Rock Pigeons',          phone: '2482024717', password: '4717bets'               },
  { name: 'Chris',  teamName: 'Bald Eagles',           phone: '2489158213', password: '8213bets'               },
  { name: 'Reid',   teamName: 'Wood Ducks',            phone: '6054153238', password: '3238bets'               },
  { name: 'Shad',   teamName: 'Eastern Bluebirds',     phone: '6072153514', password: '3514bets'               },
]

async function main() {
  console.log(`Target: ${SUPABASE_URL}\n`)
  console.log('Setting up player accounts...\n')

  for (const player of PLAYERS) {
    const email = phoneToEmail(player.phone)

    // Check if user already exists in auth
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
    const existingAuth = authUsers.find(u => u.email === email)

    if (existingAuth) {
      // Reset password for existing user
      const { error } = await supabase.auth.admin.updateUserById(existingAuth.id, {
        password: player.password,
      })
      if (error) {
        console.error(`✗ Failed to reset password for ${player.name}: ${error.message}`)
        continue
      }
      console.log(`✓ ${player.name} — password reset`)
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: player.password,
        email_confirm: true,
      })

      if (authError || !authData.user) {
        console.error(`✗ Failed to create auth user for ${player.name}: ${authError?.message}`)
        continue
      }

      // Insert profile row
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email,
        name: player.name,
        team_name: player.teamName,
        phone: player.phone,
        is_admin: player.isAdmin ?? false,
      })

      if (profileError) {
        console.error(`✗ Failed to create profile for ${player.name}: ${profileError.message}`)
        await supabase.auth.admin.deleteUser(authData.user.id)
        continue
      }

      console.log(`✓ ${player.name} — created`)
    }

    console.log(`   Text ${player.name}: "Phone: ${player.phone}  Password: ${player.password}"`)
    console.log()
  }

  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
