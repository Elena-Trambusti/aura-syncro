/** Codice errore API: tavolo con ordine/conto ancora aperti. */
export const TABLE_HAS_ACTIVE_ORDER = 'TABLE_HAS_ACTIVE_ORDER'

/**
 * Impedisce di impostare un tavolo su FREE mentre esistono ordini di sessione attivi.
 * Regola di integrità sala — usata da PATCH /tables/:id/status.
 */
export function assertTableCanBeSetFree(activeOrderCount: number): void {
  if (activeOrderCount > 0) {
    throw Object.assign(new Error('Impossibile liberare il tavolo: ordine o conto ancora aperti'), {
      code: TABLE_HAS_ACTIVE_ORDER,
    })
  }
}
