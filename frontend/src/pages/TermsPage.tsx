import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_URLS, LEGAL_VERSIONS } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function TermsPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.terms.title'), t('publicMeta.terms.description'))

  return (
    <LegalDocumentShell
      title="Termini e Condizioni di Servizio (B2B)"
      subtitle={`Ultimo aggiornamento: ${LEGAL_ENTITY.termsUpdated} (v. ${LEGAL_VERSIONS.terms}). In caso di conflitto con il contratto individuale sottoscritto, prevale il contratto firmato.`}
    >
      <LegalSection title="1. Oggetto e licenza d'uso">
        <p>
          Le presenti Condizioni disciplinano la fornitura del software cloud <strong>Aura Syncro</strong> (PWA/web)
          in modalità SaaS da <strong>{LEGAL_ENTITY.ownerName}</strong>, P.IVA {LEGAL_ENTITY.vatNumber} (il «Fornitore»).
        </p>
        <p>
          Il Fornitore concede al Cliente una <strong>licenza d&apos;uso non esclusiva, non trasferibile, non sublicenziabile e temporanea</strong>,
          limitata a un esercizio/tenant. Codice sorgente, algoritmi interni, design e marchi restano di esclusiva proprietà del Fornitore.
        </p>
      </LegalSection>

      <LegalSection title="2. Natura B2B">
        <p>
          Il Servizio è destinato esclusivamente a soggetti professionali/imprenditori. Il Cliente dichiara di non essere consumatore:
          <strong> non si applica il diritto di recesso di 14 giorni</strong> ex Codice del Consumo (D.Lgs. 206/2005).
          Per clienti con sede in altri Stati UE, le presenti Condizioni sono redatte in italiano; in caso di controversia fa fede la versione italiana salvo diverso accordo scritto.
        </p>
      </LegalSection>

      <LegalSection title="3. Piani e corrispettivi">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li><strong>Piano Starter:</strong> setup una tantum € 250,00 + canone € 99,00/mese (+ IVA)</li>
          <li><strong>Piano Premium:</strong> setup una tantum € 500,00 + canone € 199,00/mese (+ IVA)</li>
        </ul>
        <p className="mt-2">
          Pagamento anticipato del setup e addebito ricorrente automatico tramite <strong>Stripe</strong> (soggetto anche alle condizioni Stripe).
          Il setup è <strong>non rimborsabile</strong>. Il canone del periodo di fatturazione in corso non è rimborsabile in caso di recesso anticipato.
        </p>
      </LegalSection>

      <LegalSection title="4. Mancato pagamento e sospensione">
        <p>
          In caso di mancato pagamento, rifiuto transazione o chargeback ingiustificato per <strong>più di 5 (cinque) giorni consecutivi</strong>,
          il Fornitore può <strong>sospendere immediatamente</strong> l&apos;accesso e risolvere il Contratto.
          Nessun risarcimento è dovuto per interruzione del servizio in sala derivante da tale sospensione.
        </p>
      </LegalSection>

      <LegalSection title="5. Disponibilità del Servizio">
        <p className="text-slate-400">
          Il Fornitore si impegna a un ragionevole sforzo di continuità, <strong>senza garanzia di uptime specifico</strong>.
          Interruzioni per manutenzione, aggiornamenti di sicurezza, disservizi di provider (Vercel, DigitalOcean, Stripe) o forza maggiore
          non danno diritto a penali o rimborsi, salvo diverso accordo scritto.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilità fiscale e POS">
        <p>
          Aura Syncro fornisce strumenti di calcolo e reportistica interna ma <strong>non sostituisce</strong> il registratore telematico
          o il POS fiscale del Cliente ove richiesto dalla legge. Il Cliente è unico responsabile di scontrini, corrispettivi e adempimenti fiscali.
        </p>
      </LegalSection>

      <LegalSection title="7. Statistiche predittive interne">
        <p className="text-slate-400">
          Le funzionalità di analytics e suggerimenti predittivi utilizzano <strong>algoritmi matematici interni</strong>, senza API esterne di intelligenza artificiale.
          Hanno natura di supporto decisionale e <strong>non costituiscono</strong> consulenza fiscale, legale o finanziaria. Il Cliente resta responsabile delle decisioni operative.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitazione di responsabilità">
        <p>
          Salvo dolo o colpa grave, il Fornitore non risponde di danni indiretti (mancati guadagni, perdita clientela, interruzione attività,
          disallineamenti di magazzino) né di disservizi di rete locale, hardware del Cliente, forza maggiore, provider cloud (Vercel, DigitalOcean),
          Stripe o Aruba. La responsabilità complessiva è <strong>limitata all&apos;importo pagato nei 12 mesi precedenti</strong> l&apos;evento.
        </p>
      </LegalSection>

      <LegalSection title="9. Manleva">
        <p className="text-slate-400">
          Il Cliente manleva e tiene indenne il Fornitore da pretese di terzi derivanti da: uso illecito del Servizio; violazioni fiscali del Ristorante;
          informativa privacy incompleta verso gli ospiti; invii marketing senza idonea base giuridica; contenuti inseriti dal Cliente.
        </p>
      </LegalSection>

      <LegalSection title="10. Marketing email">
        <p>
          Il modulo marketing consente al Ristorante di inviare comunicazioni ai propri ospiti. Il <strong>Cliente è Titolare</strong> del trattamento
          e garantisce di possedere idonea base giuridica. Aura Syncro fornisce solo lo strumento tecnico di invio.
        </p>
      </LegalSection>

      <LegalSection title="11. Durata, recesso e dati">
        <p>
          Durata indeterminata con rinnovo mensile automatico. Il Cliente può recedere con <strong>preavviso di 15 giorni</strong> rispetto
          alla scadenza del periodo successivo, dal pannello impostazioni/Stripe o via email a {LEGAL_ENTITY.email}.
          Alla cessazione, export dati per 30 giorni; poi cancellazione salvo obblighi di legge.
        </p>
      </LegalSection>

      <LegalSection title="12. Modifiche contrattuali">
        <p className="text-slate-400">
          Il Fornitore può aggiornare i presenti Termini per adeguamenti normativi o evoluzioni funzionali, con preavviso di almeno{' '}
          <strong>30 giorni</strong> in caso di modifiche sostanziali e sfavorevoli. L&apos;uso continuato dopo il termine, o la mancata disdetta, costituisce accettazione.
        </p>
      </LegalSection>

      <LegalSection title="13. Privacy e DPA">
        <p>
          Per i dati degli ospiti del Ristorante, il Cliente è Titolare e Aura Syncro Responsabile ex art. 28 GDPR.
          L&apos;accettazione del DPA è registrata elettronicamente in registrazione. Vedi{' '}
          <Link to={LEGAL_URLS.privacy} className="text-aura-gold hover:underline">Privacy Policy</Link> e{' '}
          <Link to={LEGAL_URLS.dpa} className="text-aura-gold hover:underline">DPA</Link>.
        </p>
      </LegalSection>

      <LegalSection title="14. Legge applicabile e foro">
        <p>
          Legge italiana. Foro esclusivo: <strong>{LEGAL_ENTITY.competentCourt}</strong>, salvo fori inderogabili di legge.
        </p>
      </LegalSection>

      <LegalSection title="15. Clausole vessatorie (artt. 1341-1342 c.c.)">
        <p className="text-slate-400">
          Il Cliente approva specificamente: non rimborsabilità setup; sospensione per insoluto (5 giorni); assenza SLA garantito;
          responsabilità fiscale del Cliente; limitazione responsabilità e cap 12 mesi; manleva; recesso e cessazione dati; foro di Livorno.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
