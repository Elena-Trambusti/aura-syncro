import { test, expect } from '@playwright/test'
import { loginViaUi } from './helpers/auth'
import { assertHealthyShell } from './helpers/ui'

test.describe('Premium ops — compliance, menu CSV, table claim', () => {
  test('impostazioni mostra checklist conformità e print agent', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/impostazioni')
    await assertHealthyShell(page)

    await expect(
      page.getByText(/conformità fiscale|cumplimiento fiscal|fiscal.*compliance/i).first(),
    ).toBeVisible({ timeout: 20_000 })

    await expect(
      page.getByText(/print agent|impresión cocina/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('menu mostra pulsante import CSV', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/menu')
    await assertHealthyShell(page)

    await expect(
      page.getByRole('button', { name: /import.*csv|importar csv/i }),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('onboarding mostra verifica go-live o dashboard già attiva', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/dashboard/onboarding')
    await assertHealthyShell(page)

    const goLiveBtn = page.getByRole('button', { name: /attiva dashboard|activar dashboard|go.?live/i })
    const systemCheck = page.getByText(/verifica automatica|verificación automática|system check/i)

    const hasGoLive = await goLiveBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    const hasChecklist = await systemCheck.isVisible({ timeout: 5_000 }).catch(() => false)

    expect(hasGoLive || hasChecklist).toBe(true)
  })

})

test.describe('Premium ops — table claim mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('claim e release tavolo occupato', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/tavoli')
    await assertHealthyShell(page)

    const freeTable = page.getByRole('button', { name: /Tavolo \d+|^T\d+,/i }).first()
    await expect(freeTable).toBeVisible({ timeout: 20_000 })
    const tableLabel = (await freeTable.getAttribute('aria-label')) ?? ''
    await freeTable.click()

    const newOrderBtn = page.getByRole('button', { name: /nuova comanda|new order|nueva comanda|apri comanda|open order/i })
    await expect(newOrderBtn).toBeVisible({ timeout: 10_000 })
    await newOrderBtn.click()

    const orderDialog = page.getByRole('dialog')
    await expect(orderDialog).toBeVisible({ timeout: 15_000 })

    const menuItem = orderDialog.locator('[role="button"]').filter({ hasText: /€|\d+[,.]\d{2}/ }).first()
    await expect(menuItem).toBeVisible({ timeout: 15_000 })
    await menuItem.click()

    const sendBtn = orderDialog.getByRole('button', { name: /invia in cucina|send to kitchen|enviar a cocina/i })
    await sendBtn.click()
    await expect(page.getByText(/comanda inviata|order sent|pedido enviado/i).first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /chiudi|close|cerrar/i }).first().click({ timeout: 5_000 }).catch(() => {
      /* modale può chiudersi da sola */
    })

    const tableNum = tableLabel.replace(/[^\d]/g, '')
    if (tableNum) {
      const tableBtn = page.getByRole('button', { name: new RegExp(`Tavolo ${tableNum}|T${tableNum},`, 'i') })
      await expect(tableBtn).toBeVisible({ timeout: 10_000 })
      await tableBtn.click()

      const claimBtn = page.getByRole('button', { name: /prendi in carico|tomar mesa|claim table/i })
      await expect(claimBtn).toBeVisible({ timeout: 10_000 })
      await claimBtn.click()

      await expect(
        page.getByText(/assegnata a|asignada a|serving by/i).first(),
      ).toBeVisible({ timeout: 10_000 })

      const releaseBtn = page.getByRole('button', { name: /rilascia|liberar mesa|release table/i })
      await expect(releaseBtn).toBeVisible({ timeout: 10_000 })
      await releaseBtn.click()
    }
  })
})
