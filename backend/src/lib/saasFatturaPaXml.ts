import { AURA_SYNCRO_ISSUER } from '../config/fiscal'
import type { SaasBillingAddress, SaasCustomerFiscalProfile, SaasMappedInvoice } from './saasFiscalMapping'

export type SaasIssuerProfile = {
  vatNumber: string
  legalName: string
  fiscalCode?: string
  address: SaasBillingAddress
  /** Sempre RF19 per emittente Aura Syncro */
  regimeFiscale: typeof AURA_SYNCRO_ISSUER.fiscalRegimeCode
  email?: string
  vatExemptionClause: string
}

export type SaasFatturaPaInput = {
  invoiceNumber: string
  invoiceDate: Date
  customer: SaasCustomerFiscalProfile
  mapped: SaasMappedInvoice
  issuer: SaasIssuerProfile
  description: string
  currency?: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(value: number): string {
  return value.toFixed(2)
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildAliquotaIva(mapped: SaasMappedInvoice): string {
  if (mapped.taxRate > 0) {
    return `
        <DettaglioLinee>
          <NumeroLinea>1</NumeroLinea>
          <Descrizione>${escapeXml('Abbonamento Aura Syncro')}</Descrizione>
          <Quantita>1.00</Quantita>
          <PrezzoUnitario>${formatAmount(mapped.netAmount)}</PrezzoUnitario>
          <PrezzoTotale>${formatAmount(mapped.netAmount)}</PrezzoTotale>
          <AliquotaIVA>${formatAmount(mapped.taxRate * 100)}</AliquotaIVA>
        </DettaglioLinee>
        <DatiRiepilogo>
          <AliquotaIVA>${formatAmount(mapped.taxRate * 100)}</AliquotaIVA>
          <ImponibileImporto>${formatAmount(mapped.netAmount)}</ImponibileImporto>
          <Imposta>${formatAmount(mapped.taxAmount)}</Imposta>
          <EsigibilitaIVA>I</EsigibilitaIVA>
        </DatiRiepilogo>`
  }

  const natura = mapped.vatNature ?? AURA_SYNCRO_ISSUER.vatNatureForfettario
  return `
        <DettaglioLinee>
          <NumeroLinea>1</NumeroLinea>
          <Descrizione>${escapeXml('Abbonamento Aura Syncro')}</Descrizione>
          <Quantita>1.00</Quantita>
          <PrezzoUnitario>${formatAmount(mapped.netAmount)}</PrezzoUnitario>
          <PrezzoTotale>${formatAmount(mapped.netAmount)}</PrezzoTotale>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Natura>${escapeXml(natura)}</Natura>
        </DettaglioLinee>
        <DatiRiepilogo>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Natura>${escapeXml(natura)}</Natura>
          <ImponibileImporto>${formatAmount(mapped.netAmount)}</ImponibileImporto>
          <Imposta>0.00</Imposta>
          <EsigibilitaIVA>I</EsigibilitaIVA>
        </DatiRiepilogo>`
}

function buildBolloBlock(mapped: SaasMappedInvoice): string {
  if (!mapped.virtualStampRequired) return ''
  return `
        <BolloVirtuale>SI</BolloVirtuale>
        <ImportoBollo>${formatAmount(mapped.virtualStampAmount)}</ImportoBollo>`
}

/**
 * Genera XML FatturaPA 1.2 (formato SDI) per fattura SaaS verso ristorante.
 * Il file viene inviato ad Aruba non firmato (POST /services/invoice/upload).
 */
export function buildSaasFatturaPaXml(input: SaasFatturaPaInput): string {
  const { invoiceNumber, invoiceDate, customer, mapped, issuer, description } = input
  const currency = input.currency ?? 'EUR'
  const codiceDestinatario = mapped.sdiRecipientCode.toUpperCase()
  const pecDestinatario = mapped.pec ? `<PECDestinatario>${escapeXml(mapped.pec)}</PECDestinatario>` : ''
  const provinciaCliente = customer.address.province
    ? `<Provincia>${escapeXml(customer.address.province)}</Provincia>`
    : ''
  const provinciaEmittente = issuer.address.province
    ? `<Provincia>${escapeXml(issuer.address.province)}</Provincia>`
    : ''
  const codiceFiscaleEmittente = issuer.fiscalCode
    ? `<CodiceFiscale>${escapeXml(issuer.fiscalCode)}</CodiceFiscale>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(issuer.vatNumber.replace(/^IT/i, ''))}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(invoiceNumber)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>
      ${pecDestinatario}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(issuer.vatNumber.replace(/^IT/i, ''))}</IdCodice>
        </IdFiscaleIVA>
        ${codiceFiscaleEmittente}
        <Anagrafica>
          <Denominazione>${escapeXml(issuer.legalName)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${escapeXml(AURA_SYNCRO_ISSUER.fiscalRegimeCode)}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(issuer.address.line1)}</Indirizzo>
        <CAP>${escapeXml(issuer.address.postalCode)}</CAP>
        <Comune>${escapeXml(issuer.address.city)}</Comune>
        ${provinciaEmittente}
        <Nazione>${escapeXml(issuer.address.country)}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${escapeXml(customer.address.country)}</IdPaese>
          <IdCodice>${escapeXml(customer.vatNumber.replace(/^[A-Z]{2}/i, ''))}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${escapeXml(customer.legalName)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(customer.address.line1)}</Indirizzo>
        <CAP>${escapeXml(customer.address.postalCode)}</CAP>
        <Comune>${escapeXml(customer.address.city)}</Comune>
        ${provinciaCliente}
        <Nazione>${escapeXml(customer.address.country)}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>${escapeXml(currency)}</Divisa>
        <Data>${formatDate(invoiceDate)}</Data>
        <Numero>${escapeXml(invoiceNumber)}</Numero>
        <ImportoTotaleDocumento>${formatAmount(mapped.grossAmount)}</ImportoTotaleDocumento>${buildBolloBlock(mapped)}
        <Causale>${escapeXml(description)}</Causale>
        <Causale>${escapeXml(issuer.vatExemptionClause)}</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${buildAliquotaIva(mapped)}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP08</ModalitaPagamento>
        <DataScadenzaPagamento>${formatDate(invoiceDate)}</DataScadenzaPagamento>
        <ImportoPagamento>${formatAmount(mapped.grossAmount)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`
}

/**
 * Profilo emittente: identità fissa da config/fiscal.ts (RF19, P.IVA).
 * Sede e codice fiscale completabili via env per deploy.
 */
export function loadSaasIssuerProfile(): SaasIssuerProfile {
  const vatNumber = (process.env.ARUBA_FE_ISSUER_VAT?.trim() || AURA_SYNCRO_ISSUER.vatNumber).replace(/\s+/g, '')
  const legalName = process.env.ARUBA_FE_ISSUER_LEGAL_NAME?.trim() || AURA_SYNCRO_ISSUER.legalName

  const line1 = process.env.ARUBA_FE_ISSUER_STREET?.trim() || ''
  const city = process.env.ARUBA_FE_ISSUER_CITY?.trim() || ''
  const postalCode = process.env.ARUBA_FE_ISSUER_ZIP?.trim() || ''

  if (!line1 || !city || !postalCode) {
    throw new Error(
      'Sede emittente incompleta: configurare ARUBA_FE_ISSUER_STREET, ARUBA_FE_ISSUER_CITY e ARUBA_FE_ISSUER_ZIP',
    )
  }

  return {
    vatNumber,
    legalName,
    fiscalCode: process.env.ARUBA_FE_ISSUER_FISCAL_CODE?.trim(),
    regimeFiscale: AURA_SYNCRO_ISSUER.fiscalRegimeCode,
    email: process.env.ARUBA_FE_ISSUER_EMAIL?.trim(),
    vatExemptionClause: AURA_SYNCRO_ISSUER.vatExemptionClause,
    address: {
      line1,
      city,
      postalCode,
      province: process.env.ARUBA_FE_ISSUER_PROVINCE?.trim(),
      country: (process.env.ARUBA_FE_ISSUER_COUNTRY?.trim() || 'IT').toUpperCase(),
    },
  }
}
