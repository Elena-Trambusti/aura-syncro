import { test, expect } from '@playwright/test'
import { loginViaUi } from './helpers/auth'
import { assertHealthyShell } from './helpers/ui'

test.describe('Checkout & Cassa — flusso cameriere', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
  })

  test('ordine inviato → checkout carta → ricevuta fiscale', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/tavoli')
    await assertHealthyShell(page)

    const freeTable = page.getByRole('button', { name: /^Tavolo \d+/i }).first()
    await expect(freeTable).toBeVisible({ timeout: 20_000 })
    await freeTable.click()

    const orderDialog = page.getByRole('dialog')
    await expect(orderDialog).toBeVisible({ timeout: 15_000 })

    const menuItem = orderDialog.locator('[role="button"]').filter({ hasText: /€|\d+[,.]\d{2}/ }).first()
    await expect(menuItem).toBeVisible({ timeout: 15_000 })
    await menuItem.click()

    await orderDialog.getByRole('button', { name: /invia in cucina|send to kitchen/i }).click()
    await expect(page.getByText(/comanda inviata|piatto aggiunto|order sent/i).first()).toBeVisible({ timeout: 15_000 })

    const goToPayment = orderDialog.getByRole('button', { name: /vai al pagamento|go to payment/i })
    await expect(goToPayment).toBeVisible({ timeout: 15_000 })
    await goToPayment.click()

    await expect(page).toHaveURL(/\/checkout\//, { timeout: 15_000 })
    await assertHealthyShell(page)

    await expect(page.getByRole('heading', { name: /chiusura conto|checkout/i }).first()).toBeVisible()

    const cardBtn = page.getByRole('button', { name: /^carta$|^card$/i })
    if (await cardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cardBtn.click()
    }

    const finalizeBtn = page.getByRole('button', { name: /finalizza pagamento|finalize payment|finalizza intero/i })
    await expect(finalizeBtn).toBeEnabled({ timeout: 10_000 })
    await finalizeBtn.click()

    await expect(
      page.getByText(/pagamento finalizzato|payment finalized|ricevuta fiscale|receipt/i).first(),
    ).toBeVisible({ timeout: 25_000 })

    await assertHealthyShell(page)
  })

  test('pagina cassa — carica stato turno senza errori', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/cassa')
    await assertHealthyShell(page)

    await expect(page.getByRole('heading', { name: /turno cassa|cash drawer|caja/i }).first()).toBeVisible({ timeout: 20_000 })

    const openBtn = page.getByRole('button', { name: /apri cassa|open drawer|abrir caja/i })
    const closeBtn = page.getByRole('button', { name: /chiudi turno|close shift/i })

    const hasOpen = await openBtn.isVisible({ timeout: 3000 }).catch(() => false)
    const hasClose = await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)

    expect(hasOpen || hasClose).toBe(true)
  })
})
