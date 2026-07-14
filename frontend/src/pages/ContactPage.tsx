import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Phone, Send } from 'lucide-react'
import { LEGAL_ENTITY, LEGAL_URLS, formatLegalAddress } from '../config/legal'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function ContactPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.contact.title'), t('publicMeta.contact.description'))
  const [isSent, setIsSent] = useState(false)
  const [form, setForm] = useState({ name: '', restaurant: '', email: '', message: '' })
  const [privacyOk, setPrivacyOk] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!privacyOk) return
    const subject = encodeURIComponent(`Richiesta Aura Syncro — ${form.restaurant || form.name}`)
    const body = encodeURIComponent(
      `Nome: ${form.name}\nRistorante: ${form.restaurant || '—'}\nEmail: ${form.email}\n\n${form.message}`,
    )
    window.location.href = `mailto:${LEGAL_ENTITY.email}?subject=${subject}&body=${body}`
    setIsSent(true)
  }

  return (
    <div className="aura-auth-shell min-h-screen px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <p className="aura-brand-eyebrow mb-2">{LEGAL_ENTITY.tradeName}</p>
          <h1 className="text-4xl font-display font-medium text-white mb-4">Contattaci</h1>
          <p className="text-fumo max-w-xl mx-auto">
            Supporto tecnico, demo su misura e assistenza onboarding per clienti Premium.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="premium-card p-6 border-aura-gold/10">
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-aura-gold/10 border border-aura-gold/20 flex items-center justify-center text-aura-gold">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Email</p>
                    <a href={`mailto:${LEGAL_ENTITY.email}`} className="text-sm text-slate-400 hover:text-aura-gold transition-colors mt-1 inline-block">
                      {LEGAL_ENTITY.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-aura-gold/10 border border-aura-gold/20 flex items-center justify-center text-aura-gold">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Assistenza</p>
                    <p className="text-sm text-slate-400 mt-1">{LEGAL_ENTITY.supportHours}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-aura-gold/10 border border-aura-gold/20 flex items-center justify-center text-aura-gold">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Sede</p>
                    <p className="text-sm text-slate-400 mt-1">{formatLegalAddress()}</p>
                    <p className="text-sm text-slate-400">P.IVA {LEGAL_ENTITY.vatNumber}</p>
                    {LEGAL_ENTITY.pec && (
                      <p className="text-sm text-slate-400">PEC: {LEGAL_ENTITY.pec}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-4 space-y-2">
              <Link to="/" className="text-sm text-fumo hover:text-white transition-colors underline block">
                &larr; Torna alla Home
              </Link>
              <Link to={LEGAL_URLS.privacy} className="text-xs text-fumo hover:text-aura-gold block">Privacy Policy</Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="premium-card p-8 sm:p-10">
              {isSent ? (
                <div className="text-center py-16 animate-reveal-blur">
                  <div className="mx-auto h-16 w-16 mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Send className="h-6 w-6 ml-1" />
                  </div>
                  <h3 className="text-2xl font-display font-semibold text-white mb-2">Programma email aperto</h3>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    Invia il messaggio dal tuo programma di posta. Ti risponderemo entro 24 ore lavorative.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSent(false)}
                    className="mt-8 text-sm text-aura-gold hover:underline"
                  >
                    Invia un altro messaggio
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-fumo mb-2">Nome e Cognome *</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-aura-gold/50 focus:ring-1 focus:ring-aura-gold outline-none transition-all"
                        placeholder="Es. Mario Rossi"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-fumo mb-2">Nome Ristorante</label>
                      <input
                        type="text"
                        value={form.restaurant}
                        onChange={e => setForm(f => ({ ...f, restaurant: e.target.value }))}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-aura-gold/50 focus:ring-1 focus:ring-aura-gold outline-none transition-all"
                        placeholder="Es. Osteria La Stella"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-fumo mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-aura-gold/50 focus:ring-1 focus:ring-aura-gold outline-none transition-all"
                      placeholder="tua@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-fumo mb-2">Messaggio *</label>
                    <textarea
                      required
                      rows={5}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-aura-gold/50 focus:ring-1 focus:ring-aura-gold outline-none transition-all resize-none"
                      placeholder="Come possiamo aiutarti?"
                    />
                  </div>

                  <label className="flex items-start gap-3 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={privacyOk}
                      onChange={e => setPrivacyOk(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20"
                    />
                    <span>
                      Ho letto l&apos;<Link to={LEGAL_URLS.privacy} className="text-aura-gold hover:underline" target="_blank">informativa privacy</Link>
                      {' '}e acconsento al trattamento dei dati per rispondere alla richiesta (art. 6(1)(b) GDPR).
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all hover:-translate-y-0.5"
                  >
                    Invia via Email <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
