import { Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('/leaderboard')
}

export async function saveAuthState(page: Page, path: string) {
  await page.context().storageState({ path })
}
