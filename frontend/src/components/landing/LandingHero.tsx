import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import RegisterLink from './RegisterLink'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Zap, BarChart3, Loader2 } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { toast } from '@/lib/toast'
import { BRAND } from '../../lib/brand'
import { useAuth } from '../../contexts/AuthContext'
import { resolveDemoMarket } from '../../lib/demoAccounts'
import { markDemoSession } from '../../lib/demoSession'

export default function LandingHero() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const handleDemoLogin = async () => {
    try {
      setIsDemoLoading(true)
      const demo = resolveDemoMarket(location.pathname, i18n.language)
      await login(demo.email, demo.password, demo.slug)
      markDemoSession()
      navigate('/dashboard')
    } catch (error) {
      toast.error(t('landing.hero.demoError'))
      console.error(error)
    } finally {
      setIsDemoLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden bg-transparent px-4 pb-20 pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-28 sm:pt-[calc(6rem+env(safe-area-inset-top,0px))]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-20 hidden h-[600px] w-[600px] rounded-full bg-amber-500/20 blur-[120px] md:block" />
        <div className="absolute top-1/4 -right-32 hidden h-[700px] w-[700px] rounded-full bg-orange-500/15 blur-[140px] lg:block" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-aura-gold/20 bg-neutral-950/80 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-aura-gold motion-reduce:animate-none"
            style={{ animation: 'reveal-blur 1.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <AuraIcon icon={Sparkles} size="sm" className="text-aura-gold" />
            {t('landing.hero.badge')}
          </div>
          <h1 
            className="lux-heading text-[#C5A059] text-4xl font-display font-medium tracking-tight sm:text-5xl lg:text-7xl lg:leading-[1.1] drop-shadow-2xl"
            style={{ animation: 'reveal-blur 1.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '150ms' }}
          >
            {t('landing.hero.title')}
          </h1>
          <p 
            className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg font-light"
            style={{ animation: 'reveal-blur 1.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '300ms' }}
          >
            {t('landing.hero.subtitle', { brand: BRAND.name })}
          </p>
          <div 
            className="mt-10 flex flex-col gap-4 sm:flex-row"
            style={{ animation: 'reveal-blur 1.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '450ms' }}
          >
            <RegisterLink
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_40px_rgba(212,175,55,0.4)] ring-1 ring-white/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(212,175,55,0.6)]"
            >
              <div className="absolute inset-0 hidden w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent motion-safe:md:block motion-safe:md:animate-[shimmer-sweep_3s_ease-in-out_infinite]" />
              <span className="relative">{t('landing.hero.ctaPrimary')}</span>
              <AuraIcon icon={ArrowRight} size="md" className="relative text-black" />
            </RegisterLink>
            <button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-[#D4AF37]/20 bg-neutral-950/80 px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] lux-text-bright transition-all duration-500 hover:-translate-y-1 hover:border-aura-gold/50 hover:bg-[#D4AF37]/5 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]"
            >
              {isDemoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-aura-gold" strokeWidth={1.25} />
              ) : (
                <AuraIcon icon={Zap} size="md" className="text-aura-gold" />
              )}
              {t('landing.hero.ctaDemo')}
            </button>
          </div>
        </div>

        <div
          className="lux-hero-preview group relative hidden pt-10 lg:block lg:pt-0"
          style={{ animation: 'reveal-slide 1.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '600ms' }}
        >
          <div className="lux-hero-preview__halo" aria-hidden />
          <div className="lux-hero-preview__shell">
            <div className="lux-hero-preview__ring" aria-hidden />
            <div className="rounded-[2rem] border border-[#D4AF37]/12 bg-[#050505]/95 p-5 lux-text-soft shadow-inner transition-colors duration-700 group-hover:border-[#D4AF37]/22">
              <div className="flex items-center justify-between rounded-2xl bg-[#0a0a0a] px-5 py-4 ring-1 ring-[#D4AF37]/10">
                <div className="flex items-center gap-3 text-sm font-bold tracking-wide lux-text-bright">
                  <AuraIcon icon={Zap} size="md" className="text-aura-gold" />
                  {BRAND.name}
                </div>
                <span className="rounded-full border border-aura-gold/20 bg-aura-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-aura-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                  Live
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-[#D4AF37]/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <p className="text-[10px] uppercase tracking-[0.2em] lux-text-faint">{t('landing.hero.previewKpi1')}</p>
                  <p className="mt-2 text-3xl font-display font-medium lux-text-bright">+18%</p>
                </div>
                <div className="rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-[#D4AF37]/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <p className="text-[10px] uppercase tracking-[0.2em] lux-text-faint">{t('landing.hero.previewKpi2')}</p>
                  <p className="mt-2 text-3xl font-display font-medium lux-text-bright">124</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-[#D4AF37]/10">
                <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] lux-text-faint">
                  <AuraIcon icon={BarChart3} size="sm" className="text-aura-gold/80" />
                  {t('landing.hero.previewChart')}
                </div>
                <div className="flex h-28 items-end gap-2 sm:gap-3">
                  {[35, 55, 40, 68, 72, 58, 80].map((height, idx) => (
                    <div
                      key={idx}
                      className="flex-1 rounded-sm bg-gradient-to-t from-aura-gold/10 to-aura-gold shadow-[0_0_15px_rgba(212,175,55,0.3)] relative group cursor-crosshair transition-all duration-500 hover:scale-y-[1.05] hover:brightness-125"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
