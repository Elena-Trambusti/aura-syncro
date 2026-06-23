import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildSaasFatturaPaXml } from './saasFatturaPaXml'
import { AURA_SYNCRO_ISSUER } from '../config/fiscal'
import type { SaasCustomerFiscalProfile, SaasMappedInvoice } from './saasFiscalMapping'

const issuer = {
  vatNumber: AURA_SYNCRO_ISSUER.vatNumber,
  legalName: AURA_SYNCRO_ISSUER.legalName,
  regimeFiscale: AURA_SYNCRO_ISSUER.fiscalRegimeCode,
  vatExemptionClause: AURA_SYNCRO_ISSUER.vatExemptionClause,
  address: {
    line1: 'Via Roma 1',
    city: 'Livorno',
    postalCode: '57100',
    province: 'LI',
    country: 'IT',
  },
}

const customer: SaasCustomerFiscalProfile = {
  legalName: 'Ristorante Demo SRL',
  vatNumber: 'IT12345678901',
  sdiRecipientCode: 'ABCDEFG',
  address: {
    line1: 'Piazza Duomo 1',
    city: 'Milano',
    postalCode: '20100',
    province: 'MI',
    country: 'IT',
  },
}

const mapped199: SaasMappedInvoice = {
  regime: 'IT_FORFETTARIO',
  netAmount: 199,
  taxAmount: 0,
  grossAmount: 199,
  taxRate: 0,
  vatNature: 'N2.2',
  sdiRecipientCode: 'ABCDEFG',
  recipientCodeType: 'SDI',
  virtualStampRequired: true,
  virtualStampAmount: 2,
}

describe('buildSaasFatturaPaXml', () => {
  it('include RF19, N2.2 e bollo virtuale per abbonamento 199€', () => {
    const xml = buildSaasFatturaPaXml({
      invoiceNumber: 'SAAS-2026-001',
      invoiceDate: new Date('2026-06-23'),
      customer,
      mapped: mapped199,
      issuer,
      description: 'Abbonamento mensile Aura Syncro',
    })

    assert.match(xml, /<RegimeFiscale>RF19<\/RegimeFiscale>/)
    assert.match(xml, /<Natura>N2\.2<\/Natura>/)
    assert.match(xml, /<BolloVirtuale>SI<\/BolloVirtuale>/)
    assert.match(xml, /<ImportoBollo>2\.00<\/ImportoBollo>/)
    assert.match(xml, /non soggetta a IVA/)
    assert.match(xml, /<AliquotaIVA>0\.00<\/AliquotaIVA>/)
    assert.match(xml, /<Imposta>0\.00<\/Imposta>/)
  })

  it('non applica bollo sotto soglia 77,47€', () => {
    const mappedSmall: SaasMappedInvoice = {
      ...mapped199,
      netAmount: 50,
      grossAmount: 50,
      virtualStampRequired: false,
      virtualStampAmount: 0,
    }

    const xml = buildSaasFatturaPaXml({
      invoiceNumber: 'SAAS-2026-002',
      invoiceDate: new Date('2026-06-23'),
      customer,
      mapped: mappedSmall,
      issuer,
      description: 'Setup Aura Syncro',
    })

    assert.doesNotMatch(xml, /<BolloVirtuale>/)
    assert.match(xml, /<Natura>N2\.2<\/Natura>/)
  })
})
