import { test, expect } from '@playwright/test'
import {
  createTestUser, deleteTestUser, testEmail,
  createTestBetstravaganza, deleteTestBetstravaganza,
  createTestSlateGame, setDraftOrder,
} from './helpers/db'
import { loginAs } from './helpers/auth'

test.describe('Player slate picks', () => {
  let player: Awaited<ReturnType<typeof createTestUser>>
  let admin: Awaited<ReturnType<typeof createTestUser>>
  let bzId: string

  test.beforeAll(async () => {
    ;[player, admin] = await Promise.all([
      createTestUser({ email: testEmail('slate-player'), name: 'Slate Player', teamName: 'Slate Team' }),
      createTestUser({ email: testEmail('slate-admin'), name: 'Slate Admin', teamName: 'Admin Slate', isAdmin: true }),
    ])

    const bz = await createTestBetstravaganza({ name: 'E2E Slate BZ', playerCount: 2, roundCount: 2 })
    bzId = bz.id

    await Promise.all([
      createTestSlateGame(bzId, { awayTeam: 'Yankees', homeTeam: 'Red Sox', sortOrder: 0 }),
      createTestSlateGame(bzId, { awayTeam: 'Cubs', homeTeam: 'Cardinals', sortOrder: 1 }),
      createTestSlateGame(bzId, { awayTeam: 'Dodgers', homeTeam: 'Giants', sortOrder: 2 }),
    ])

    await setDraftOrder(bzId, [player.id, admin.id])
  })

  test.afterAll(async () => {
    await deleteTestBetstravaganza(bzId)
    await Promise.all([deleteTestUser(player.id), deleteTestUser(admin.id)])
  })

  test('my-picks page shows slate form with all games', async ({ page }) => {
    await loginAs(page, player.email, player.password)
    await page.goto('/my-picks')

    await expect(page.getByText(/yankees @ red sox/i)).toBeVisible()
    await expect(page.getByText(/cubs @ cardinals/i)).toBeVisible()
    await expect(page.getByText(/dodgers @ giants/i)).toBeVisible()
  })

  test('submit button is disabled until all games are picked', async ({ page }) => {
    await loginAs(page, player.email, player.password)
    await page.goto('/my-picks')

    const submitBtn = page.getByRole('button', { name: /submit slate picks/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('player can submit slate picks and see confirmation', async ({ page }) => {
    await loginAs(page, player.email, player.password)
    await page.goto('/my-picks')

    // Pick the away team for each game (ranks auto-assigned by drag order)
    await page.getByRole('button', { name: /^yankees away$/i }).click()
    await page.getByRole('button', { name: /^cubs away$/i }).click()
    await page.getByRole('button', { name: /^dodgers away$/i }).click()

    const submitBtn = page.getByRole('button', { name: /submit slate picks/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Should show update button after submission
    await expect(page.getByRole('button', { name: /update/i })).toBeVisible({ timeout: 8000 })
  })

  test('admin slate page shows player as submitted after picks submitted', async ({ page }) => {
    await loginAs(page, admin.email, admin.password)
    await page.goto('/admin/slate')

    await expect(page.getByText('Slate Team')).toBeVisible()
    // The player should show as SUBMITTED
    await expect(
      page.getByText(/submitted/i).first()
    ).toBeVisible()
  })

  test('player can update slate picks', async ({ page }) => {
    await loginAs(page, player.email, player.password)
    await page.goto('/my-picks')

    // Switch to home teams
    await page.getByRole('button', { name: /^red sox home$/i }).click()
    await page.getByRole('button', { name: /^cardinals home$/i }).click()
    await page.getByRole('button', { name: /^giants home$/i }).click()

    // After changing picks the button reverts to "Submit Slate Picks"
    await page.getByRole('button', { name: /submit slate picks/i }).click()

    await expect(page.getByRole('button', { name: /update/i })).toBeVisible({ timeout: 8000 })
  })
})
