import type { Prisma } from '@prisma/client'

/**
 * Scala ingredienti dal magazzino in base alla ricetta (BOM) del piatto.
 * Idempotente per riga ordine tramite flag `inventoryDeducted`.
 */
export async function deductInventoryForOrderItem(
  tx: Prisma.TransactionClient,
  orderItemId: string,
  restaurantId: string,
): Promise<void> {
  const item = await tx.orderItem.findFirst({
    where: { id: orderItemId, order: { restaurantId } },
    include: {
      menuItem: { include: { inventoryLinks: true } },
    },
  })
  if (!item || item.inventoryDeducted || item.status === 'CANCELLED') return
  if (item.menuItem.inventoryLinks.length === 0) {
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: { inventoryDeducted: true },
    })
    return
  }

  const deductions = new Map<string, number>()
  for (const link of item.menuItem.inventoryLinks) {
    const amount = link.quantity * item.quantity
    if (amount <= 0) continue
    deductions.set(link.inventoryItemId, (deductions.get(link.inventoryItemId) ?? 0) + amount)
  }

  for (const [inventoryItemId, amount] of [...deductions.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, restaurantId, quantity: { gte: amount } },
      data: { quantity: { decrement: amount } },
    })
    if (updated.count === 0) {
      throw Object.assign(new Error('INSUFFICIENT_STOCK'), { code: 'INSUFFICIENT_STOCK' })
    }
  }

  await tx.orderItem.update({
    where: { id: orderItemId },
    data: { inventoryDeducted: true },
  })
}

/** Scala magazzino per tutte le righe non ancora dedotte di un ordine */
export async function deductInventoryForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
): Promise<void> {
  await deductInventoryForOrderBatched(tx, orderId, restaurantId)
}

/**
 * Versione batch: una query per le righe, aggregazione in memoria, meno round-trip DB.
 * Usata nel percorso background post-pagamento.
 */
export async function deductInventoryForOrderBatched(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId, inventoryDeducted: false, status: { not: 'CANCELLED' } },
    include: { menuItem: { include: { inventoryLinks: true } } },
  })
  if (items.length === 0) return

  const deductions = new Map<string, number>()
  const markDeductedIds: string[] = []

  for (const item of items) {
    if (item.menuItem.inventoryLinks.length === 0) {
      markDeductedIds.push(item.id)
      continue
    }
    for (const link of item.menuItem.inventoryLinks) {
      const amount = link.quantity * item.quantity
      if (amount <= 0) continue
      deductions.set(link.inventoryItemId, (deductions.get(link.inventoryItemId) ?? 0) + amount)
    }
    markDeductedIds.push(item.id)
  }

  for (const [inventoryItemId, amount] of [...deductions.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const updated = await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, restaurantId, quantity: { gte: amount } },
      data: { quantity: { decrement: amount } },
    })
    if (updated.count === 0) {
      throw Object.assign(new Error('INSUFFICIENT_STOCK'), { code: 'INSUFFICIENT_STOCK' })
    }
  }

  if (markDeductedIds.length > 0) {
    await tx.orderItem.updateMany({
      where: { id: { in: markDeductedIds } },
      data: { inventoryDeducted: true },
    })
  }
}

/** Ripristina ingredienti se una riga ordine viene annullata */
export async function restoreInventoryForOrderItem(
  tx: Prisma.TransactionClient,
  orderItemId: string,
  restaurantId: string,
): Promise<void> {
  const item = await tx.orderItem.findFirst({
    where: { id: orderItemId, order: { restaurantId } },
    include: {
      menuItem: { include: { inventoryLinks: true } },
    },
  })
  if (!item || !item.inventoryDeducted || item.status !== 'CANCELLED') return

  for (const link of item.menuItem.inventoryLinks) {
    const amount = link.quantity * item.quantity
    if (amount <= 0) continue
    await tx.inventoryItem.updateMany({
      where: { id: link.inventoryItemId, restaurantId },
      data: { quantity: { increment: amount } },
    })
  }

  await tx.orderItem.update({
    where: { id: orderItemId },
    data: { inventoryDeducted: false },
  })
}

/** Al pagamento: scala solo righe non ancora dedotte (compatibilità ordini legacy) */
export async function decrementInventoryForUnpaidItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  restaurantId: string,
): Promise<void> {
  await deductInventoryForOrder(tx, orderId, restaurantId)
}
