import { prisma } from './prisma'
import { computePaymentSplit } from './tipFiscal'

export interface FinalizePaymentInput {
  orderId: string
  restaurantId: string
  tipAmount?: number
  paymentMethod: 'CASH' | 'CARD' | 'STRIPE' | 'VOUCHER' | 'DIGITAL'
}

export interface FinalizePaymentResult {
  revenueAmount: number
  tipAmount: number
  total: number
  paidAt: Date
}

export { computePaymentSplit }

export async function releaseTableIfEmpty(tableId: string | null | undefined): Promise<void> {
  if (!tableId) return
  const activeOrders = await prisma.order.count({
    where: {
      tableId,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  })
  if (activeOrders === 0) {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'CLEANING' },
    })
  }
}
