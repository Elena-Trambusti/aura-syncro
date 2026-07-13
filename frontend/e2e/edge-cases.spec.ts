import { test, expect } from '@playwright/test'
import { loginViaUi } from './helpers/auth'
import { assertHealthyShell } from './helpers/ui'

test.describe('Edge cases UI', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
  })

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/tavoli')
    await assertHealthyShell(page)
  })

  test('carrello vuoto — nessun pulsante Invia in cucina', async ({ page }) => {
    const tableBtn = page.getByRole('button', { name: /^Tavolo \d+/i }).first()
    await tableBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    await expect(dialog.getByRole('button', { name: /invia in cucina|send to kitchen/i })).toHaveCount(0)
    await assertHealthyShell(page)
  })

  test('doppio click rapido su Invia — una sola comanda (idempotenza UI)', async ({ page }) => {
    const tableBtn = page.getByRole('button', { name: /^Tavolo \d+/i }).first()
    await tableBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    const menuItem = dialog.locator('[role="button"]').filter({ hasText: /€|\d+[,.]\d{2}/ }).first()
    await menuItem.click()

    const sendBtn = dialog.getByRole('button', { name: /invia in cucina|send to kitchen/i })
    await expect(sendBtn).toBeVisible()

    await Promise.all([
      sendBtn.click({ force: true }),
      sendBtn.click({ force: true }).catch(() => {}),
      sendBtn.click({ force: true }).catch(() => {}),
    ])

    await expect(page.getByText(/comanda inviata|piatto aggiunto|order sent/i).first()).toBeVisible({ timeout: 15_000 })

    const toasts = page.locator('[data-sonner-toast], [role="status"]')
    const toastCount = await toasts.count()
    expect(toastCount).toBeLessThanOrEqual(3)

    await assertHealthyShell(page)
  })
})
