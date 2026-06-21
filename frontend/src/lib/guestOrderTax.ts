export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeGuestOrderTax(subtotal: number, taxRate: number) {
  const rate = taxRate / 100
  const tax = roundMoney(subtotal * rate)
  const total = roundMoney(subtotal + tax)
  return { subtotal: roundMoney(subtotal), tax, total }
}
