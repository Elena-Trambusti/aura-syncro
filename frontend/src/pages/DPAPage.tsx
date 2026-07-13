import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_SUB_PROCESSORS, LEGAL_URLS, LEGAL_VERSIONS } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function DPAPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.dpa.title'), t('publicMeta.dpa.description'))

  return (
    <LegalDocumentShell
      title="Data Processing Agreement (DPA)"
      subtitle={`Versione ${LEGAL_VERSIONS.dpa} — Accordo ex art. 28 GDPR — Allegato ai Termini di Servizio e al contratto commerciale`}
    >
      <LegalSection title="1. Parti e ruoli">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li><strong>Titolare del trattamento:</strong> il Ristorante (Cliente B2B)</li>
          <li><strong>Responsabile del trattamento:</strong> {LEGAL_ENTITY.ownerName} ({LEGAL_ENTITY.tradeName}), P.IVA {LEGAL_ENTITY.vatNumber}</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Oggetto, durata e natura">
        <p className="text-slate-400">
          Trattamento dei dati personali degli ospiti/personale inseriti nel Servizio (ordini, prenotazioni, CRM, pagamenti)
          per la durata del contratto SaaS e per i 30 giorni successivi alla cessazione (export/cancellazione),
          salvo obblighi legali diversi.
        </p>
      </LegalSection>

      <LegalSection title="3. Tipologie di dati e interessati">
        <p className="text-slate-400">
          Interessati: commensali, prenotanti, clienti CRM, dipendenti del Ristorante autorizzati.
          Dati: nome, contatti, preferenze ordine, storico visite, dati di pagamento tokenizzati via Stripe (il Responsabile non memorizza PAN carte).
        </p>
      </LegalSection>

      <LegalSection title="4. Istruzioni del Titolare">
        <p className="text-slate-400">
          Il Responsabile tratta i dati solo su istruzioni documentate del Titolare, manifestate tramite utilizzo conforme
          del Servizio e mediante il presente DPA. Il Responsabile informa il Titolare se ritiene un&apos;istruzione illecita.
        </p>
      </LegalSection>

      <LegalSection title="5. Obblighi del Responsabile">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Riservatezza del personale autorizzato</li>
          <li>Misure di sicurezza art. 32 GDPR (HTTPS, access control, backup, multi-tenancy)</li>
          <li>Assistenza al Titolare per richieste degli interessati e DPIA ove necessario</li>
          <li>Cancellazione/restituzione a fine contratto</li>
          <li>Non utilizzo dei dati ospiti per marketing proprio o profilazione incrociata tra ristoranti</li>
          <li>Elaborazioni statistiche interne mediante algoritmi matematici propri, senza cessione a provider AI esterni</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Sub-responsabili">
        <p>Il Titolare autorizza i seguenti sub-responsabili con obblighi equivalenti:</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400 mt-2">
          {LEGAL_SUB_PROCESSORS.map(sp => (
            <li key={sp.name}><strong>{sp.name}</strong> — {sp.purpose}</li>
          ))}
        </ul>
        <p className="mt-2 text-slate-400">
          Il Responsabile informerà il Titolare di sostituzioni sostanziali con preavviso ragionevole (almeno 15 giorni); il Titolare può opporsi per motivi legittimi.
        </p>
      </LegalSection>

      <LegalSection title="7. Violazioni dei dati (data breach)">
        <p className="text-slate-400">
          Il Responsabile notifica al Titolare senza ingiustificato ritardo e, ove possibile, entro <strong>72 ore</strong>
          dalla presa di conoscenza, fornendo informazioni disponibili per consentire l&apos;adempimento agli obblighi del Titolare verso il Garante e gli interessati.
        </p>
      </LegalSection>

      <LegalSection title="8. Audit">
        <p className="text-slate-400">
          Il Titolare, con preavviso ragionevole e non più di una volta ogni 12 mesi (salvo incidente di sicurezza),
          può richiedere documentazione sulle misure tecniche e organizzative adottate.
        </p>
      </LegalSection>

      <LegalSection title="9. Accettazione e prova">
        <p>
          L&apos;accettazione del DPA avviene mediante checkbox in registrazione (con timestamp, versione documento, IP e user-agent),
          sottoscrizione del contratto commerciale o primo pagamento del Servizio.
          Per il testo integrale vedi anche il contratto in{' '}
          <code className="text-aura-gold">CONTRATTO_ABBONAMENTO_AURA_SYNCRO_PREMIUM.md</code>.
          Informativa generale: <Link to={LEGAL_URLS.privacy} className="text-aura-gold hover:underline">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
