import { expect, type Locator, type Page } from '@playwright/test'

/** Modale comanda fullscreen — esclude cookie banner e bottom sheet tavolo. */
export function getOrderDialog(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /tavolo|table|mesa|tisch/i }),
  })
}

/** Apre il tab Menu nel modale comanda (layout mobile a tab). */
export async function openOrderMenuTab(orderDialog: Locator) {
  const menuTab = orderDialog.getByRole('button', { name: /^menu$|^menú$|^menù$/i })
  if (await menuTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await menuTab.click()
  }
}

/** Seleziona il primo piatto disponibile nel modale comanda. */
export async function addFirstPricedMenuItem(orderDialog: Locator) {
  await openOrderMenuTab(orderDialog)

  const menuItem = orderDialog.getByRole('button').filter({ hasText: /€|\d+[,.]\d{2}/ }).first()
  await menuItem.scrollIntoViewIfNeeded()
  await expect(menuItem).toBeVisible({ timeout: 15_000 })
  await menuItem.click()

  const addWithModifiers = orderDialog.getByRole('button', {
    name: /aggiungi|add for|añadir|hinzufügen/i,
  })
  if (await addWithModifiers.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await addWithModifiers.click()
  }
}

/** Su mobile il pulsante invio è nel tab Ordine/Carrello. */
export async function openOrderCartTab(orderDialog: Locator) {
  const goToOrder = orderDialog.getByRole('button', {
    name: /go to order|vai all.?ordine|ir al pedido|zur bestellung/i,
  })
  if (await goToOrder.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await goToOrder.click()
    return
  }

  const orderTab = orderDialog.getByRole('button', { name: /^order$|^ordine$|^pedido$|^bestellung$/i })
  if (await orderTab.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await orderTab.click()
  }
}

/** Chiude il modale comanda fullscreen (mobile). */
export async function closeOrderDialog(orderDialog: Locator) {
  await orderDialog.getByRole('button', { name: /chiudi|close|cerrar|schließen|fermer/i }).click()
  await expect(orderDialog).toBeHidden({ timeout: 15_000 })
}

/** Aggiunge un piatto e invia la comanda in cucina. */
export async function addItemAndSendToKitchen(page: Page, orderDialog: Locator) {
  await addFirstPricedMenuItem(orderDialog)
  await openOrderCartTab(orderDialog)

  const sendBtn = orderDialog.getByRole('button', {
    name: /invia in cucina|send to kitchen|enviar a cocina|an küche senden|envoyer en cuisine/i,
  })
  await expect(sendBtn).toBeVisible({ timeout: 15_000 })
  await sendBtn.click()

  await expect(
    page.getByText(/comanda inviata|order sent|pedido enviado|piatto aggiunto/i).first(),
  ).toBeVisible({ timeout: 15_000 })
}
