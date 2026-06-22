import { Prisma, OrderStatus, type Order, type Table } from '@prisma/client'
import { prisma } from './prisma'

const CLOSED_ORDER_STATUSES: OrderStatus[] = ['PAID', 'CANCELLED']

type TransferResult = {
  order: Order
  sourceTable: Table
  targetTable: Table
}

function newTransferError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

async function findActiveOrderOnTable(
  tx: Prisma.TransactionClient,
  tableId: string,
  restaurantId: string,
): Promise<Order | null> {
  return tx.order.findFirst({
    where: {
      restaurantId,
      tableId,
      status: { notIn: CLOSED_ORDER_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function transferOrderBetweenTables(
  restaurantId: string,
  sourceTableId: string,
  targetTableId: string,
): Promise<TransferResult> {
  if (sourceTableId === targetTableId) {
    throw newTransferError('TABLE_TRANSFER_SAME_TABLE', 'Tavolo sorgente e destinazione coincidono')
  }

  return prisma.$transaction(async tx => {
    const [sourceTable, targetTable] = await Promise.all([
      tx.table.findFirst({ where: { id: sourceTableId, restaurantId } }),
      tx.table.findFirst({ where: { id: targetTableId, restaurantId } }),
    ])

    if (!sourceTable) {
      throw newTransferError('TABLE_TRANSFER_SOURCE_NOT_FOUND', 'Tavolo sorgente non trovato')
    }
    if (!targetTable) {
      throw newTransferError('TABLE_TRANSFER_TARGET_NOT_FOUND', 'Tavolo destinazione non trovato')
    }

    const activeOrder = await findActiveOrderOnTable(tx, sourceTable.id, restaurantId)
    if (!activeOrder) {
      throw newTransferError('TABLE_TRANSFER_NO_ACTIVE_ORDER', 'Nessun ordine attivo sul tavolo sorgente')
    }

    if (targetTable.status !== 'FREE') {
      throw newTransferError('TABLE_TRANSFER_TARGET_UNAVAILABLE', 'Tavolo destinazione non disponibile')
    }

    const targetActiveOrder = await findActiveOrderOnTable(tx, targetTable.id, restaurantId)
    if (targetActiveOrder) {
      throw newTransferError('TABLE_TRANSFER_TARGET_OCCUPIED', 'Il tavolo destinazione ha già un ordine attivo')
    }

    const [order, updatedTargetTable] = await Promise.all([
      tx.order.update({
        where: { id: activeOrder.id },
        data: { tableId: targetTable.id },
      }),
      tx.table.update({
        where: { id: targetTable.id },
        data: { status: 'OCCUPIED' },
      }),
    ])

    const sourceStillHasActiveOrders = await tx.order.count({
      where: {
        restaurantId,
        tableId: sourceTable.id,
        status: { notIn: CLOSED_ORDER_STATUSES },
      },
    })

    const updatedSourceTable = await tx.table.update({
      where: { id: sourceTable.id },
      data: { status: sourceStillHasActiveOrders > 0 ? 'OCCUPIED' : 'CLEANING' },
    })

    return {
      order,
      sourceTable: updatedSourceTable,
      targetTable: updatedTargetTable,
    }
  })
}
