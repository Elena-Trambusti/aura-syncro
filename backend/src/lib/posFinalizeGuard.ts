import type { PosIntegrationMode } from '@prisma/client'

export type PosSettlementMethod = 'CARD' | 'CASH'

export function assertExternalPosNativeConfirmed(
  posMode: PosIntegrationMode,
  settlementMethod: PosSettlementMethod,
  nativePosConfirmed: boolean,
): { ok: true } | { ok: false; code: 'EXTERNAL_POS_TABLET_REQUIRED'; error: string } {
  if (posMode === 'EXTERNAL' && settlementMethod === 'CARD' && !nativePosConfirmed) {
    return {
      ok: false,
      code: 'EXTERNAL_POS_TABLET_REQUIRED',
      error: 'Pagamento carta con POS esterno disponibile solo da tablet Android con conferma terminale',
    }
  }
  return { ok: true }
}
