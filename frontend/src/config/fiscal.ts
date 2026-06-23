/**
 * Dati fiscali ufficiali Aura Syncro (emittente SaaS).
 * Allineato a backend/src/config/fiscal.ts
 */
export const AURA_SYNCRO_FISCAL = {
  ownerName: 'Elena Trambusti',
  vatNumber: '02101860498',
  fiscalRegimeCode: 'RF19' as const,
  vatNatureForfettario: 'N2.2' as const,
  vatExemptionClause:
    'Operazione effettuata ai sensi dell\'articolo 1, commi da 54 a 89, della Legge n. 190 del 23 dicembre 2014 e successive modificazioni, e pertanto non soggetta a IVA né a ritenuta d\'acconto.',
  virtualStampThreshold: 77.47,
  virtualStampAmount: 2.0,
} as const

export function formatIssuerFooterLine(): string {
  return `${AURA_SYNCRO_FISCAL.ownerName} | P.IVA ${AURA_SYNCRO_FISCAL.vatNumber}`
}
