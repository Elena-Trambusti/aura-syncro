import crypto from 'crypto'

function secret(): string {
  return process.env.TABLE_QR_SECRET || process.env.JWT_SECRET || 'aura-table-qr-dev'
}

/** Token HMAC per binding tavolo ↔ QR (impedisce ID injection su tavoli liberi). */
export function signTableToken(restaurantId: string, tableNumber: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`${restaurantId}:${tableNumber}`)
    .digest('base64url')
}

export function verifyTableToken(
  restaurantId: string,
  tableNumber: number,
  token: string | undefined,
): boolean {
  if (!token?.trim()) return false
  const expected = signTableToken(restaurantId, tableNumber)
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(token.trim())
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
