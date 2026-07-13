import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LegalDocumentShell, { LegalSection } from '../components/legal/LegalDocumentShell'
import { LEGAL_ENTITY, LEGAL_URLS, LEGAL_VERSIONS } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function CookiePage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.cookie.title'), t('publicMeta.cookie.description'))

  return (
    <LegalDocumentShell
      title="Cookie Policy"
      subtitle={`Ultimo aggiornamento: ${LEGAL_ENTITY.privacyUpdated} (v. ${LEGAL_VERSIONS.cookie})`}
    >
      <LegalSection title="1. Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo memorizzati sul dispositivo. Aura Syncro utilizza anche tecnologie analoghe
          (es. <code className="text-aura-gold">localStorage</code> per lingua e consenso cookie).
        </p>
      </LegalSection>

      <LegalSection title="2. Cookie tecnici e strettamente necessari (senza consenso)">
        <ul className="list-disc pl-5 space-y-1 text-slate-400">
          <li><strong>Sessione e autenticazione:</strong> token JWT / sessione per mantenere l&apos;accesso al gestionale</li>
          <li><strong>Sicurezza:</strong> prevenzione CSRF e integrità richieste</li>
          <li><strong>Preferenze:</strong> lingua UI, consenso cookie (<code>aura-cookie-consent</code> in localStorage)</li>
          <li><strong>PWA:</strong> cache service worker per funzionamento offline limitato</li>
          <li><strong>Stripe</strong> — cookie tecnici per pagamenti e prevenzione frodi durante checkout</li>
        </ul>
        <p className="mt-2 text-slate-400">Senza questi strumenti il Servizio non è utilizzabile.</p>
      </LegalSection>

      <LegalSection title="3. Cookie e strumenti che richiedono consenso">
        <p className="text-slate-400 mb-2">
          I seguenti strumenti vengono attivati <strong>solo se selezioni «Accetta tutti»</strong> nel banner cookie:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-slate-400">
          <li>
            <strong>Vercel Analytics / Speed Insights</strong> — statistiche aggregate di visita e performance web
            (nessuna profilazione pubblicitaria)
          </li>
          <li>
            <strong>Sentry</strong> — rilevamento errori applicativi per stabilità del servizio
          </li>
        </ul>
        <p className="mt-2">
          Se selezioni <strong>«Solo necessari»</strong>, questi strumenti non vengono caricati. Il gestionale resta pienamente utilizzabile.
        </p>
        <p className="mt-2">
          <strong>Non utilizziamo</strong> cookie di profilazione pubblicitaria (es. Meta Pixel, Google Ads).
        </p>
      </LegalSection>

      <LegalSection title="4. Base giuridica">
        <p className="text-slate-400">
          Cookie/tecnologie tecniche: necessità contrattuale e legittimo interesse (art. 6(1)(b) e (f) GDPR; ePrivacy).
          Analytics e monitoraggio errori: <strong>consenso</strong> dell&apos;utente (art. 6(1)(a) GDPR; Direttiva ePrivacy come recepita in Italia).
          Puoi revocare il consenso cancellando <code>aura-cookie-consent</code> dal browser e ricaricando la pagina, oppure contattando {LEGAL_ENTITY.email}.
        </p>
      </LegalSection>

      <LegalSection title="5. Gestione">
        <p>
          Puoi gestire i cookie dal browser e tramite il banner in piattaforma.
          Per maggiori informazioni sui dati personali, vedi la{' '}
          <Link to={LEGAL_URLS.privacy} className="text-aura-gold hover:underline">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  )
}
