import { test, expect } from '@playwright/test'

const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.describe('Dashboard autenticata', () => {
  test.skip(!email || !password, 'Richiede E2E_EMAIL e E2E_PASSWORD')

  test('login e navigazione ordini/tavoli', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#login-email').fill(email!)
    await page.locator('#login-password').fill(password!)
    await page.getByRole('button', { name: /accedi|sign in|entrar/i }).click()

    await expect(page).toHaveURL(/\/(dashboard|ordini|tavoli|onboarding)/, { timeout: 30_000 })

    await page.goto('/ordini')
    await expect(page.locator('body')).toContainText(/ordini|orders|pedidos/i, { timeout: 15_000 })

    await page.goto('/tavoli')
    await expect(page.locator('body')).toContainText(/tavoli|tables|mesas/i, { timeout: 15_000 })
  })
})
