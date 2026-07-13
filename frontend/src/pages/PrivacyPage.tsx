import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_SUB_PROCESSORS, LEGAL_URLS, LEGAL_VERSIONS, formatLegalAddress } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function PrivacyPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.privacy.title'), t('publicMeta.privacy.description'))

  return (
    <LegalDocumentShell
      title="Informativa sulla Privacy"
      subtitle={`Ultimo aggiornamento: ${LEGAL_ENTITY.privacyUpdated} (v. ${LEGAL_VERSIONS.privacy}) — ai sensi degli artt. 13-14 Regolamento (UE) 2016/679 (GDPR)`}
    >
      <LegalSection title="1. Titolare del trattamento">
        <p>
          <strong>{LEGAL_ENTITY.ownerName}</strong> — P.IVA {LEGAL_ENTITY.vatNumber}<br />
          Sede: {formatLegalAddress()}<br />
          Email: <a href={`mailto:${LEGAL_ENTITY.email}`} className="text-aura-gold hover:underline">{LEGAL_ENTITY.email}</a>
          {LEGAL_ENTITY.pec && (
            <>
              <br />
              PEC: <a href={`mailto:${LEGAL_ENTITY.pec}`} className="text-aura-gold hover:underline">{LEGAL_ENTITY.pec}</a>
            </>
          )}
        </p>
        {!LEGAL_ENTITY.pec && (
          <p className="text-slate-400 mt-2">
            Per comunicazioni a mezzo PEC è possibile utilizzare l&apos;indirizzo email sopra indicato fino all&apos;attivazione di una casella PEC dedicata.
          </p>
        )}
        <p className="text-slate-400 mt-2">
          Non è stato nominato un Responsabile della Protezione dei Dati (DPO) ai sensi dell&apos;art. 37 GDPR,
          non essendo obbligatorio per la dimensione e la natura dei trattamenti effettuati dal Fornitore quale titolare B2B.
        </p>
      </LegalSection>

      <LegalSection title="2. Ambito — due livelli di trattamento">
        <p><strong>A) Dati dei Ristoratori (clienti B2B di Aura Syncro)</strong></p>
        <p className="text-slate-400">
          Dati identificativi, di contatto, fatturazione (ragione sociale, P.IVA, email, telefono) e dati di utilizzo del Servizio.
          Il Titolare è <strong>{LEGAL_ENTITY.ownerName}</strong>.
        </p>
        <p className="mt-3"><strong>B) Dati degli ospiti dei Ristoranti (commensali, prenotanti)</strong></p>
        <p className="text-slate-400">
          Aura Syncro tratta tali dati <strong>solo come Responsabile del trattamento</strong> per conto del Ristorante (Titolare).
          Vedi <Link to={LEGAL_URLS.dpa} className="text-aura-gold hover:underline">DPA</Link> e{' '}
          <Link to={LEGAL_URLS.guestPrivacy} className="text-aura-gold hover:underline">Informativa ospiti</Link>.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalità e basi giuridiche (clienti B2B)">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Erogazione del Servizio SaaS e gestione account — <em>art. 6(1)(b) GDPR</em> (contratto)</li>
          <li>Fatturazione, adempimenti fiscali e contabili — <em>art. 6(1)(c) GDPR</em> (obbligo legale)</li>
          <li>Assistenza tecnica e sicurezza della piattaforma — <em>art. 6(1)(f) GDPR</em> (legittimo interesse)</li>
          <li>Comunicazioni commerciali B2B su prodotti analoghi — <em>art. 6(1)(f) GDPR</em>, con opt-out in ogni email</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Statistiche predittive interne (nessuna AI esterna)">
        <p className="text-slate-400">
          Aura Syncro può elaborare dati operativi del Ristorante (ordini, consumi, giacenze) mediante{' '}
          <strong>algoritmi matematici e regole statistiche eseguiti interamente sui server del Fornitore</strong>,
          senza invio di dati a modelli di intelligenza artificiale di terzi né a API esterne di machine learning.
          Gli output hanno natura di supporto decisionale e <strong>non costituiscono decisioni automatizzate</strong> ai sensi
          dell&apos;art. 22 GDPR nei confronti degli ospiti. Le scelte operative restano in capo al Ristorante.
        </p>
      </LegalSection>

      <LegalSection title="5. Conservazione">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Dati contabili/amministrativi B2B: <strong>10 anni</strong> (normativa fiscale italiana)</li>
          <li>Dati operativi del Ristorante (ordini, prenotazioni): per la durata dell&apos;abbonamento + <strong>30 giorni</strong> post-cessazione</li>
          <li>Log di sicurezza: fino a <strong>12 mesi</strong>, salvo obblighi diversi</li>
          <li>Prova di accettazione Termini/DPA in registrazione: per la durata del rapporto contrattuale + termini di prescrizione applicabili</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Destinatari e sub-responsabili">
        <p>I dati possono essere trattati da personale autorizzato del Fornitore e dai seguenti responsabili esterni:</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400 mt-2">
          {LEGAL_SUB_PROCESSORS.map(sp => (
            <li key={sp.name}>
              <strong>{sp.name}</strong> — {sp.purpose} ({sp.region})
            </li>
          ))}
        </ul>
        <p className="mt-2 text-slate-400">
          Trasferimenti verso Paesi extra-UE (es. USA) avvengono sulla base di Clausole Contrattuali Standard (Decisione UE 2021/914)
          e, ove applicabile, del EU-US Data Privacy Framework. Il Cliente può richiedere informazioni aggiuntive o copia delle garanzie via email.
        </p>
        <p className="mt-2 text-slate-400">
          Il Fornitore informerà il Cliente con preavviso ragionevole in caso di sostituzione sostanziale dei sub-responsabili.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookie e tecnologie simili">
        <p>
          Vedi la <Link to={LEGAL_URLS.cookie} className="text-aura-gold hover:underline">Cookie Policy</Link>.
          Cookie tecnici, Stripe (pagamenti/antifrode) e preferenze locali (es. consenso cookie in localStorage).
          Statistiche Vercel e monitoraggio Sentry sono attivati <strong>solo previo consenso</strong> tramite banner cookie.
          Non utilizziamo pixel pubblicitari (Facebook/Google Ads) sul gestionale B2B.
        </p>
      </LegalSection>

      <LegalSection title="8. Diritti dell'interessato">
        <p>
          In qualità di interessato (ristoratore B2B) puoi esercitare i diritti di accesso, rettifica, cancellazione, limitazione,
          opposizione e portabilità scrivendo a {LEGAL_ENTITY.email}. Hai diritto di proporre reclamo al{' '}
          <a href={LEGAL_URLS.garante} className="text-aura-gold hover:underline" target="_blank" rel="noopener noreferrer">
            Garante per la protezione dei dati personali
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="9. Sicurezza e violazioni dei dati">
        <p className="text-slate-400">
          Misure adottate: HTTPS, autenticazione, isolamento multi-tenant, backup, controllo accessi basato su ruoli,
          monitoraggio errori (con consenso). In caso di violazione dei dati personali che riguardi dati trattati come Responsabile,
          il Fornitore notificherà il Ristorante titolare senza ingiustificato ritardo, come da DPA.
        </p>
      </LegalSection>

      <LegalSection title="10. Servizi della società dell'informazione (DSA)">
        <p className="text-slate-400">
          Per segnalazioni relative a contenuti illeciti ospitati tramite la piattaforma o richieste delle autorità,
          contattare: <a href={`mailto:${LEGAL_ENTITY.dsaContactEmail}`} className="text-aura-gold hover:underline">{LEGAL_ENTITY.dsaContactEmail}</a>.
          Aura Syncro non è una piattaforma «VLOP»; il Ristorante resta responsabile dei contenuti pubblicati verso i propri ospiti.
        </p>
      </LegalSection>

      <LegalSection title="11. Modifiche">
        <p className="text-slate-400">
          Il Titolare può aggiornare la presente informativa. La data e la versione sono indicate in testa.
          Modifiche sostanziali saranno comunicate via email o avviso in piattaforma con almeno 30 giorni di preavviso ove richiesto.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
