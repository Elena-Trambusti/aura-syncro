import { expect, type Page } from '@playwright/test'

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
