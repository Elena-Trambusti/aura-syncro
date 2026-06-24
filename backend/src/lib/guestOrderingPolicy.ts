/** Guest ordering from QR menu — enabled by default; set GUEST_ORDERING_ENABLED=false to disable */
export function isGuestOrderingEnabled(): boolean {
  return process.env.GUEST_ORDERING_ENABLED !== 'false'
}

export const GUEST_ORDERING_DISABLED = {
  error: 'Gli ordini dal menu QR sono disabilitati. Rivolgiti al cameriere.',
  code: 'GUEST_ORDERING_DISABLED',
} as const
