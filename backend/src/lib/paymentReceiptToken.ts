import jwt from 'jsonwebtoken'

const ORDER_RECEIPT_PURPOSE = 'order-receipt'
const DEPOSIT_RECEIPT_PURPOSE = 'deposit-receipt'

/** Token monouso per consultare la ricevuta post-checkout guest (24h). */
export function signOrderReceiptToken(orderId: string): string {
  return jwt.sign(
    { orderId, purpose: ORDER_RECEIPT_PURPOSE },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' },
  )
}

export function verifyOrderReceiptToken(token: string, orderId: string): boolean {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      orderId?: string
      purpose?: string
    }
    return payload.purpose === ORDER_RECEIPT_PURPOSE && payload.orderId === orderId
  } catch {
    return false
  }
}

/** Token monouso per consultare la conferma caparra (24h). */
export function signDepositReceiptToken(reservationId: string): string {
  return jwt.sign(
    { reservationId, purpose: DEPOSIT_RECEIPT_PURPOSE },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' },
  )
}

export function verifyDepositReceiptToken(token: string, reservationId: string): boolean {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      reservationId?: string
      purpose?: string
    }
    return payload.purpose === DEPOSIT_RECEIPT_PURPOSE && payload.reservationId === reservationId
  } catch {
    return false
  }
}
