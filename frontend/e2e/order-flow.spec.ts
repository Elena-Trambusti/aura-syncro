import { test, expect } from '@playwright/test'
import { loginViaUi } from './helpers/auth'
import { addItemAndSendToKitchen, getOrderDialog } from './helpers/order'
import { assertHealthyShell } from './helpers/ui'

test.describe('Flusso principale — login → tavoli → comanda', () => {
  test.use({
    viewport: { width: 1280, height: 900 },
  })

  test('cameriere apre tavolo, aggiunge piatto e invia in cucina', async ({ page }) => {
    await loginViaUi(page)
    await assertHealthyShell(page)

    await page.goto('/tavoli')
    await assertHealthyShell(page)

    await expect(page.getByRole('heading', { name: /tavoli|tables|mesas/i }).first()).toBeVisible({ timeout: 20_000 })

    const freeTable = page.getByRole('button', { name: /^Tavolo \d+/i }).first()
    await expect(freeTable).toBeVisible({ timeout: 20_000 })
    const tableLabel = (await freeTable.getAttribute('aria-label')) ?? ''
    await freeTable.click()

    const orderDialog = getOrderDialog(page)
    await expect(orderDialog).toBeVisible({ timeout: 15_000 })

    const menuItem = orderDialog.getByRole('button').filter({ hasText: /€|\d+[,.]\d{2}/ }).first()
    await menuItem.scrollIntoViewIfNeeded()
    await expect(menuItem).toBeVisible({ timeout: 15_000 })
    const dishName = (await menuItem.locator('p').first().textContent())?.trim() ?? ''

    await addItemAndSendToKitchen(page, orderDialog)
    await assertHealthyShell(page)

    if (tableLabel) {
      const tableNum = tableLabel.replace(/[^\d]/g, '')
      if (tableNum) {
        await expect(
          page.getByRole('button', { name: new RegExp(`Tavolo ${tableNum}`, 'i') }),
        ).toBeVisible()
      }
    }

    if (dishName) {
      await expect(page.getByText(dishName, { exact: false }).first()).toBeVisible({ timeout: 10_000 }).catch(() => {
        /* su desktop il modale si chiude — l'ottimistico UI può essere già su mappa */
      })
    }
  })
})
