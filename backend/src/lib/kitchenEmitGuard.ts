/**
 * Regole per emissione ticket cucina.
 * Un ordine non valido (es. piatto esaurito) non deve mai entrare in coda KDS.
 */
export function shouldEmitKitchenTicket(orderCreated: boolean): boolean {
  return orderCreated
}

/** Filtra ordini che non devono comparire in coda cucina dopo un tentativo fallito. */
export function kitchenTicketsAfterOrderAttempt<T extends { id: string }>(
  createdOrder: T | null,
): T[] {
  return createdOrder ? [createdOrder] : []
}
