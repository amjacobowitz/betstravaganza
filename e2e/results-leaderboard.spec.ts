import { test, expect } from '@playwright/test'
import {
  createTestUser, deleteTestUser, testEmail,
  createTestBetstravaganza, deleteTestBetstravaganza,
  createTestEvent, createTestBetOption, setDraftOrder,
  recordDraftPick, upsertResult,
} from './helpers/db'
import { loginAs } from './helpers/auth'

test.describe('Results entry and leaderboard', () => {
  let admin: Awaited<ReturnType<typeof createTestUser>>
  let player: Awaited<ReturnType<typeof createTestUser>>
  let bzId: string
  let eventId: string
  let winnerOptionId: string
  let loserOptionId: string

  test.beforeAll(async () => {
    ;[admin, player] = await Promise.all([
      createTestUser({ email: testEmail('results-admin'), name: 'Results Admin', teamName: 'Admin Team', isAdmin: true }),
      createTestUser({ email: testEmail('results-player'), name: 'Results Player', teamName: 'Winners FC' }),
    ])

    const bz = await createTestBetstravaganza({ name: 'E2E Results BZ', playerCount: 2, roundCount: 2 })
    bzId = bz.id

    const event = await createTestEvent(bzId, { name: 'Belmont Stakes', sport: 'Horse Racing', category: 'required', betType: 'odds' })
    eventId = event.id

    const [winner, loser] = await Promise.all([
      createTestBetOption(event.id, { label: 'Justify', odds: -150 }),
      createTestBetOption(event.id, { label: 'American Pharoah', odds: 300 }),
    ])
    winnerOptionId = winner.id
    loserOptionId = loser.id

    await setDraftOrder(bzId, [player.id, admin.id])
    // Player picks the winning horse
    await recordDraftPick({ bzId, userId: player.id, betOptionId: winnerOptionId, pickIndex: 0 })
  })

  test.afterAll(async () => {
    await deleteTestBetstravaganza(bzId)
    await Promise.all([deleteTestUser(admin.id), deleteTestUser(player.id)])
  })

  test('results page shows events to enter results for', async ({ page }) => {
    await loginAs(page, admin.email, admin.password)
    await page.goto('/admin/results')

    await expect(page.getByText('Belmont Stakes')).toBeVisible()
    await expect(page.getByRole('button', { name: /save result/i }).first()).toBeVisible()
  })

  test('admin can enter a result', async ({ page }) => {
    await loginAs(page, admin.email, admin.password)
    await page.goto('/admin/results')

    // Select winner
    await page.getByLabel(/winner/i).selectOption(winnerOptionId)
    await page.getByLabel(/result display/i).fill('Justify wins in 2:03.45')
    await page.getByRole('button', { name: /save result/i }).click()

    await expect(page.getByText('✓ Saved')).toBeVisible({ timeout: 8000 })
  })

  test('leaderboard shows player with a win after result entered', async ({ page }) => {
    // Enter result via db helper (faster, doesn't depend on prior test)
    await upsertResult({ eventId, winnerBetOptionId: winnerOptionId, resultDisplay: 'Justify wins' })

    await loginAs(page, player.email, player.password)
    await page.goto('/leaderboard')

    await expect(page.getByText('Winners FC')).toBeVisible()
    // W-L-P: should show at least 1 win
    const row = page.getByText('Winners FC').locator('..').locator('..')
    await expect(row.getByText(/1/)).toBeVisible()
  })

  test('my-picks page shows outcome for resolved pick', async ({ page }) => {
    await upsertResult({ eventId, winnerBetOptionId: winnerOptionId, resultDisplay: 'Justify wins' })

    await loginAs(page, player.email, player.password)
    await page.goto('/my-picks')

    await expect(page.getByText('Justify').first()).toBeVisible()
    await expect(page.getByText('WIN', { exact: true })).toBeVisible()
  })

  test('my-picks shows LOSS for losing pick', async ({ page }) => {
    await upsertResult({ eventId, winnerBetOptionId: winnerOptionId, resultDisplay: 'Justify wins' })

    // Admin holds the losing pick — record it
    await recordDraftPick({ bzId, userId: admin.id, betOptionId: loserOptionId, pickIndex: 1 })

    await loginAs(page, admin.email, admin.password)
    await page.goto('/my-picks')

    await expect(page.getByText('American Pharoah')).toBeVisible()
    await expect(page.getByText('LOSS')).toBeVisible()
  })

  test('leaderboard is sorted by total (winner first)', async ({ page }) => {
    await loginAs(page, player.email, player.password)
    await page.goto('/leaderboard')

    // Winners FC (win) should appear before Admin Team (loss)
    const rows = page.locator('tbody tr')
    const firstRow = rows.first()
    await expect(firstRow).toContainText('Winners FC')
  })
})
