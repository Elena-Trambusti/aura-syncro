/** Stato split conto lato client — allineato a splitPaidGuestIndexes backend */

export function isSplitGuestPaid(
  guestIndex: number,
  splitPaidGuestIndexes: number[] | undefined | null,
): boolean {
  return (splitPaidGuestIndexes ?? []).includes(guestIndex)
}

export function nextUnpaidSplitGuest(
  guestCount: number,
  splitPaidGuestIndexes: number[] | undefined | null,
): number | null {
  for (let i = 0; i < guestCount; i++) {
    if (!isSplitGuestPaid(i, splitPaidGuestIndexes)) return i
  }
  return null
}

export function splitProgressLabel(
  collectedAmount: number,
  checkoutTotal: number,
): { collected: number; remaining: number; pct: number } {
  const collected = Math.round(collectedAmount * 100) / 100
  const total = Math.round(checkoutTotal * 100) / 100
  const remaining = Math.max(0, Math.round((total - collected) * 100) / 100)
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0
  return { collected, remaining, pct }
}
