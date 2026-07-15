import { expect, type Page } from '@playwright/test'

/** Chiude il banner cookie se compare (evita conflitti con getByRole('dialog')). */
export async function dismissCookieBannerIfVisible(page: Page) {
  const banner = page.locator('[aria-labelledby="cookie-banner-title"]')
  if (await banner.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await banner.getByRole('button').first().click()
    await expect(banner).toBeHidden({ timeout: 5_000 })
  }
}

/** Verifica che non ci siano schermate nere / error boundary. */
export async function assertHealthyShell(page: Page) {
  const root = page.locator('#root')
  await expect(root).toBeVisible()
  await expect(root).not.toBeEmpty()

  const errorBoundary = page.getByRole('heading', { name: /si è verificato un errore/i })
  await expect(errorBoundary).toHaveCount(0)

  const bootShell = page.locator('#pwa-boot-shell')
  if (await bootShell.count()) {
    await expect(bootShell).toBeHidden()
  }
}
