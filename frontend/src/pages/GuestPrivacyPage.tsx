import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_URLS } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

/**
 * Informativa per commensali/ospiti — il Titolare è il Ristorante, non Aura Syncro.
 * Il ristoratore può linkare questa pagina dal menu QR o dalla pagina prenotazioni.
 */
export default function GuestPrivacyPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.guestPrivacy.title'), t('publicMeta.guestPrivacy.description'))

  return (
    <LegalDocumentShell
      title="Informativa privacy per gli ospiti"
      subtitle="Informazione ai sensi dell'art. 13 GDPR — dati raccolti tramite menu digitale e prenotazioni"
    >
      <LegalSection title="1. Chi tratta i tuoi dati">
        <p>
          Quando ordini o prenoti presso un ristorante che utilizza <strong>Aura Syncro</strong>, i tuoi dati personali
          sono trattati dal <strong>Ristorante</strong> (es. titolare dell'esercizio) quale <strong>Titolare del trattamento</strong>.
        </p>
        <p className="text-slate-400 mt-2">
          <strong>{LEGAL_ENTITY.ownerName}</strong> ({LEGAL_ENTITY.tradeName}) agisce solo come{' '}
          <strong>Responsabile del trattamento</strong> (fornitore tecnologico della piattaforma), su istruzioni del Ristorante.
          Per esercitare i diritti privacy (accesso, cancellazione, ecc.) contatta principalmente il Ristorante dove hai mangiato/prenotato.
        </p>
      </LegalSection>

      <LegalSection title="2. Quali dati possono essere raccolti">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Nome e cognome (se forniti)</li>
          <li>Email e/o telefono (prenotazioni, ricevuta ordine, programma fedeltà)</li>
          <li>Dettagli ordine (piatti, allergeni dichiarati, note)</li>
          <li>Numero tavolo (ordine da QR)</li>
          <li>Dati di pagamento gestiti da <strong>Stripe</strong> (Aura Syncro non memorizza il numero della carta)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalità">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li>Gestione ordine e servizio al tavolo</li>
          <li>Prenotazioni e comunicazioni relative alla tua prenotazione</li>
          <li>Pagamento elettronico</li>
          <li>Programma fedeltà (solo se aderisci e il Ristorante lo offre)</li>
          <li>Email marketing del Ristorante (solo con consenso o altra base lecita applicabile)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Conservazione">
        <p className="text-slate-400">
          I tempi di conservazione sono determinati dal Ristorante titolare, nel rispetto della legge.
          In generale, i dati operativi restano per la durata del rapporto commerciale con il Ristorante;
          Aura Syncro li conserva sulla piattaforma per il periodo contrattuale con il Ristorante e fino a 30 giorni dopo la cessazione del servizio.
        </p>
      </LegalSection>

      <LegalSection title="5. I tuoi diritti">
        <p>
          Puoi chiedere al <strong>Ristorante</strong> accesso, rettifica, cancellazione, limitazione, portabilità e opposizione
          al trattamento dei tuoi dati. Puoi inoltre proporre reclamo al{' '}
          <a href={LEGAL_URLS.garante} className="text-aura-gold hover:underline" target="_blank" rel="noopener noreferrer">
            Garante Privacy
          </a>.
        </p>
        <p className="mt-2 text-slate-400">
          Per assistenza tecnica sulla piattaforma: {LEGAL_ENTITY.email}
        </p>
      </LegalSection>

      <LegalSection title="6. Per i Ristoratori (Titolari)">
        <p>
          Se sei titolare di un ristorante, devi integrare questa informativa con i tuoi dati (ragione sociale, contatti, finalità specifiche)
          e mostrarla agli ospiti (link nel menu QR, sito, locale). Template completo in{' '}
          <code className="text-aura-gold">docs/INFORMATIVA_OSPITI_RISTORATORE.md</code>.
          Vedi anche il <Link to={LEGAL_URLS.dpa} className="text-aura-gold hover:underline">DPA</Link>.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
