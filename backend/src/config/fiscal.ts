/**
 * Dati fiscali ufficiali dell'emittente SaaS (Aura Syncro).
 * Libera Professionista — Regime Forfettario (RF19).
 *
 * I valori identitari sono fissi nel codice; sede e CF possono essere
 * completati via variabili d'ambiente ARUBA_FE_ISSUER_* (vedi loadSaasIssuerProfile).
 */
export const AURA_SYNCRO_ISSUER = {
  /** Titolare / ragione sociale in fattura */
  legalName: 'Elena Trambusti',
  /** Partita IVA (senza prefisso IT) */
  vatNumber: '02101860498',
  /** Codice regime fiscale Agenzia delle Entrate — Forfettario */
  fiscalRegimeCode: 'RF19' as const,
  /** Natura IVA per prestazioni non soggette (forfettario) */
  vatNatureForfettario: 'N2.2' as const,
  /**
   * Dicitura obbligatoria su fatture/ricevute per operazioni in regime forfettario.
   */
  vatExemptionClause:
    'Operazione effettuata ai sensi dell\'articolo 1, commi da 54 a 89, della Legge n. 190 del 23 dicembre 2014 e successive modificazioni, e pertanto non soggetta a IVA né a ritenuta d\'acconto.',
  /** Soglia imponibile per bollo virtuale (€) */
  virtualStampThreshold: 77.47,
  /** Importo bollo virtuale (€) */
  virtualStampAmount: 2.0,
} as const

export type AuraSyncroIssuerConfig = typeof AURA_SYNCRO_ISSUER

/** Formato footer sito: "Elena Trambusti | P.IVA 02101860498" */
export function formatIssuerFooterLine(): string {
  return `${AURA_SYNCRO_ISSUER.legalName} | P.IVA ${AURA_SYNCRO_ISSUER.vatNumber}`
}

export function requiresVirtualStamp(grossAmount: number): boolean {
  return grossAmount > AURA_SYNCRO_ISSUER.virtualStampThreshold
}
