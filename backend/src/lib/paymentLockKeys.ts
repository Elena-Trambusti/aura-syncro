/** Shared payment finalize lock key (completePayment + splitGuestPayment). */
export function orderPaymentFinalizeLockKey(orderId: string): string {
  return `payment:finalize:${orderId}`
}

export function orderPaymentFailureKey(orderId: string): string {
  return `payment:failure:${orderId}`
}
