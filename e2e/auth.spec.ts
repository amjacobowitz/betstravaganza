import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, testEmail } from './helpers/db'

test.describe('Authentication', () => {
  test('signup creates account and redirects to leaderboard', async ({ page }) => {
    const email = testEmail('signup')
    let userId: string | undefined

    try {
      await page.goto('/signup')

      await page.getByLabel('Name', { exact: true }).fill('Test Player')
      await page.getByLabel('Team Name').fill('Test Team')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill('Test-Password-123!')
      await page.getByRole('button', { name: /create account/i }).click()

      await page.waitForURL('/leaderboard', { timeout: 10000 })
      await expect(page).toHaveURL('/leaderboard')

      // Nav should be visible
      await expect(page.getByText(/leaderboard/i).first()).toBeVisible()
    } finally {
      // Clean up — find user id by email via admin API
      if (email) {
        const { createClient } = await import('@supabase/supabase-js')
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SECRET_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
        const { data } = await sb.from('users').select('id').eq('email', email).maybeSingle()
        if (data?.id) await deleteTestUser(data.id)
      }
    }
  })

  test('signup shows error for duplicate email', async ({ page }) => {
    const user = await createTestUser({
      email: testEmail('dup'),
      name: 'Dup User',
      teamName: 'Dup Team',
    })

    try {
      await page.goto('/signup')
      await page.getByLabel('Name', { exact: true }).fill('Another User')
      await page.getByLabel('Team Name').fill('Another Team')
      await page.getByLabel('Email').fill(user.email)
      await page.getByLabel('Password').fill('Test-Password-123!')
      await page.getByRole('button', { name: /create account/i }).click()

      // Should stay on signup and show an error
      await expect(page).toHaveURL('/signup')
      await expect(page.locator('.text-danger').first()).toBeVisible({ timeout: 5000 })
    } finally {
      await deleteTestUser(user.id)
    }
  })

  test('login with valid credentials redirects to leaderboard', async ({ page }) => {
    const user = await createTestUser({
      email: testEmail('login'),
      name: 'Login User',
      teamName: 'Login Team',
    })

    try {
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(user.email)
      await page.getByLabel(/password/i).fill(user.password)
      await page.getByRole('button', { name: /sign in/i }).click()

      await page.waitForURL('/leaderboard', { timeout: 10000 })
      await expect(page).toHaveURL('/leaderboard')
    } finally {
      await deleteTestUser(user.id)
    }
  })

  test('login with wrong password shows error', async ({ page }) => {
    const user = await createTestUser({
      email: testEmail('badpw'),
      name: 'Bad PW User',
      teamName: 'Bad PW Team',
    })

    try {
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(user.email)
      await page.getByLabel(/password/i).fill('wrong-password')
      await page.getByRole('button', { name: /sign in/i }).click()

      await expect(page).toHaveURL('/login')
      await expect(page.locator('.text-danger').first()).toBeVisible({ timeout: 5000 })
    } finally {
      await deleteTestUser(user.id)
    }
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/leaderboard')
    await expect(page).toHaveURL('/login')
  })

  test('logout signs out and redirects to login', async ({ page }) => {
    const user = await createTestUser({
      email: testEmail('logout'),
      name: 'Logout User',
      teamName: 'Logout Team',
    })

    try {
      // Login
      await page.goto('/login')
      await page.getByLabel(/email/i).fill(user.email)
      await page.getByLabel(/password/i).fill(user.password)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL('/leaderboard', { timeout: 10000 })

      // Logout
      await page.getByRole('button', { name: /log out|sign out/i }).click()
      await page.waitForURL('/login', { timeout: 5000 })
      await expect(page).toHaveURL('/login')
    } finally {
      await deleteTestUser(user.id)
    }
  })
})
