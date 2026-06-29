import { Link } from 'react-router-dom'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_URLS } from '../config/legal'

export default function CookiePage() {
  return (
    <LegalDocumentShell
      title="Cookie Policy"
      subtitle={`Ultimo aggiornamento: ${LEGAL_ENTITY.privacyUpdated}`}
    >
      <LegalSection title="1. Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo memorizzati sul dispositivo dell'utente. Aura Syncro li utilizza per
          funzionamento, sicurezza e — in forma aggregata — per misurare le prestazioni del sito.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookie tecnici e strettamente necessari (senza consenso)">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li><strong>Sessione e autenticazione:</strong> token JWT / sessione per mantenere l'accesso al gestionale</li>
          <li><strong>Sicurezza:</strong> prevenzione CSRF e integrità richieste</li>
          <li><strong>Preferenze:</strong> lingua UI, consenso cookie (`aura-cookie-consent` in localStorage)</li>
          <li><strong>PWA:</strong> cache service worker per funzionamento offline limitato</li>
        </ul>
        <p className="mt-2 text-slate-400">Senza questi cookie il Servizio non è utilizzabile.</p>
      </LegalSection>

      <LegalSection title="3. Cookie e tecnologie di terze parti">
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>
            <strong>Stripe</strong> — pagamenti e prevenzione frodi (necessari al checkout abbonamento e pagamenti ospite)
          </li>
          <li>
            <strong>Vercel Analytics / Speed Insights</strong> — statistiche aggregate di visita e performance web
            (dati non utilizzati per profilazione pubblicitaria)
          </li>
          <li>
            <strong>Sentry</strong> — rilevamento errori applicativi per stabilità del servizio
          </li>
        </ul>
        <p className="mt-2">
          <strong>Non utilizziamo</strong> cookie di profilazione pubblicitaria (es. Meta Pixel, Google Ads) sul gestionale B2B.
        </p>
      </LegalSection>

      <LegalSection title="4. Base giuridica">
        <p className="text-slate-400">
          Cookie tecnici: legittimo interesse e necessità contrattuale (art. 6(1)(b) e (f) GDPR).
          Analytics aggregati e monitoraggio errori: legittimo interesse del Fornitore a migliorare il Servizio (art. 6(1)(f)),
          con possibilità di opposizione contattando {LEGAL_ENTITY.email}.
        </p>
      </LegalSection>

      <LegalSection title="5. Gestione">
        <p>
          Puoi gestire i cookie dal browser. La disabilitazione dei cookie tecnici impedisce l'accesso ad Aura Syncro.
          Per maggiori informazioni sui dati personali, vedi la{' '}
          <Link to={LEGAL_URLS.privacy} className="text-aura-gold hover:underline">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
