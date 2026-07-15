import { expect, type Page } from '@playwright/test'

/** Credenziali seed CI — vedi backend/src/seed.ts (E2E_OWNER_EMAIL). */
export const E2E_OWNER_EMAIL = 'owner@e2e.aurasyncro.test'

export type E2ECredentials = {
  email: string
  password: string
  restaurantSlug?: string
}

export function getE2ECredentials(): E2ECredentials {
  return {
    email: process.env.E2E_EMAIL ?? E2E_OWNER_EMAIL,
    password: process.env.E2E_PASSWORD ?? 'admin123',
    restaurantSlug: process.env.E2E_RESTAURANT_SLUG ?? 'demo-it',
  }
}

/** Login UI sicuro — attende redirect dashboard o selezione tenant. */
export async function loginViaUi(page: Page, creds: E2ECredentials = getE2ECredentials()) {
  await page.goto('/login')
  await page.locator('#login-email').fill(creds.email)
  await page.locator('#login-password').fill(creds.password)

  const slugField = page.locator('#login-restaurant')
  if (await slugField.isVisible({ timeout: 1500 }).catch(() => false)) {
    if (creds.restaurantSlug) {
      const tagName = await slugField.evaluate(el => el.tagName)
      if (tagName === 'SELECT') {
        await slugField.selectOption(creds.restaurantSlug)
      } else {
        await slugField.fill(creds.restaurantSlug)
      }
    }
  }

  await page.getByRole('button', { name: /accedi|sign in|entrar/i }).click()

  await expect(page).toHaveURL(/\/(dashboard|tavoli|dashboard\/onboarding)/, { timeout: 30_000 })
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(0, 0, 0)')
}
