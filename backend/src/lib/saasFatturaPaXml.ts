import type { SaasBillingAddress, SaasCustomerFiscalProfile, SaasMappedInvoice } from './saasFiscalMapping'

export type SaasIssuerProfile = {
  vatNumber: string
  legalName: string
  fiscalCode?: string
  address: SaasBillingAddress
  regimeFiscale: string
  email?: string
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

  const natura = mapped.vatNature ?? 'N2.1'
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
        <Anagrafica>
          <Denominazione>${escapeXml(issuer.legalName)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>${escapeXml(issuer.regimeFiscale)}</RegimeFiscale>
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
        <ImportoTotaleDocumento>${formatAmount(mapped.grossAmount)}</ImportoTotaleDocumento>
        <Causale>${escapeXml(description)}</Causale>
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

export function loadSaasIssuerProfile(): SaasIssuerProfile {
  const vatNumber = process.env.ARUBA_FE_ISSUER_VAT?.trim()
  const legalName = process.env.ARUBA_FE_ISSUER_LEGAL_NAME?.trim()

  if (!vatNumber || !legalName) {
    throw new Error('ARUBA_FE_ISSUER_VAT e ARUBA_FE_ISSUER_LEGAL_NAME sono obbligatori')
  }

  return {
    vatNumber: vatNumber.replace(/\s+/g, ''),
    legalName,
    fiscalCode: process.env.ARUBA_FE_ISSUER_FISCAL_CODE?.trim(),
    regimeFiscale: process.env.ARUBA_FE_ISSUER_REGIME?.trim() || 'RF01',
    email: process.env.ARUBA_FE_ISSUER_EMAIL?.trim(),
    address: {
      line1: process.env.ARUBA_FE_ISSUER_STREET?.trim() || '',
      city: process.env.ARUBA_FE_ISSUER_CITY?.trim() || '',
      postalCode: process.env.ARUBA_FE_ISSUER_ZIP?.trim() || '',
      province: process.env.ARUBA_FE_ISSUER_PROVINCE?.trim(),
      country: (process.env.ARUBA_FE_ISSUER_COUNTRY?.trim() || 'IT').toUpperCase(),
    },
  }
}
