import type { PosIntegrationMode } from '@prisma/client'

export type PosSettlementMethod = 'CARD' | 'CASH'

export function assertExternalPosNativeConfirmed(
  posMode: PosIntegrationMode,
  settlementMethod: PosSettlementMethod,
  nativePosConfirmed: boolean,
  nativePosTerminalRef?: string | null,
): { ok: true } | { ok: false; code: 'EXTERNAL_POS_TABLET_REQUIRED'; error: string } {
  if (posMode !== 'EXTERNAL' || settlementMethod !== 'CARD') {
    return { ok: true }
  }
  const ref = typeof nativePosTerminalRef === 'string' ? nativePosTerminalRef.trim() : ''
  if (!nativePosConfirmed || ref.length < 4) {
    return {
      ok: false,
      code: 'EXTERNAL_POS_TABLET_REQUIRED',
      error:
        'Pagamento carta con POS esterno richiede conferma tablet e riferimento terminale (txId)',
    }
  }
  return { ok: true }
}
