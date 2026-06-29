import { test, expect } from '@playwright/test'

test.describe('Aura Syncro smoke', () => {
  test('landing page loads with brand', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Aura Syncro/i)
    await expect(page.getByRole('link', { name: /login|accedi|sign in/i }).first()).toBeVisible()
  })

  test('public login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /accedi|sign in|entrar/i }).first()).toBeVisible()
  })
})
