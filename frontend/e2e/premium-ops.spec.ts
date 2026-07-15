import { test, expect } from '@playwright/test'
import { loginViaUi } from './helpers/auth'
import { addItemAndSendToKitchen } from './helpers/order'
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

    const onboardingMarker = page.getByText(
      /verifica automatica|automatic go-live|verificación automática|go-live verification|benvenuto in aura syncro|welcome to aura syncro|controlli di sistema|system checks|configurazione tecnica pronta|technical setup is ready|attiva dashboard operativa|activate operational dashboard/i,
    ).first()

    await expect(onboardingMarker).toBeVisible({ timeout: 25_000 })
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

    await addItemAndSendToKitchen(page, orderDialog)

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
