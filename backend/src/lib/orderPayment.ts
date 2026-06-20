import { prisma } from './prisma'

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

export function computePaymentSplit(existing: {
  revenueAmount: number | null
  total: number
  subtotal: number
  tax: number
}, tipAmountInput?: number): FinalizePaymentResult {
  const foodTotal = existing.revenueAmount ?? existing.total ?? (existing.subtotal + existing.tax)
  const revenueAmount = Math.round(foodTotal * 100) / 100
  const tipAmount = Math.round(Math.max(0, Number(tipAmountInput) || 0) * 100) / 100
  const total = Math.round((revenueAmount + tipAmount) * 100) / 100
  return { revenueAmount, tipAmount, total, paidAt: new Date() }
}

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
