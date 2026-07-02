
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BarChart3 } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { BRAND } from '../../lib/brand'
export default function LandingHero() {
  const { t } = useTranslation()

  return (
    <section
      className="relative overflow-hidden bg-transparent px-4 pb-20 pt-[calc(5rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-28 sm:pt-[calc(6rem+env(safe-area-inset-top,0px))]"
      itemScope
      itemType="https://schema.org/SoftwareApplication"
    >
      <meta itemProp="name" content={BRAND.name} />
      <link itemProp="url" href="https://www.aurasyncro.com/" />
      <meta itemProp="applicationCategory" content="BusinessApplication" />
      <meta itemProp="operatingSystem" content="Web" />
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-20 hidden h-[600px] w-[600px] rounded-full bg-amber-500/20 blur-[120px] md:block" />
        <div className="absolute top-1/4 -right-32 hidden h-[700px] w-[700px] rounded-full bg-orange-500/15 blur-[140px] lg:block" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div
            className="lux-hero-badge motion-reduce:animate-none motion-safe:animate-[reveal-blur_0.8s_cubic-bezier(0.16,1,0.3,1)_both]"
          >
            <span className="lux-hero-badge__icon" aria-hidden>
              <img src="/brand/aura-syncro-logo-new.png" alt="" className="h-3.5 w-3.5 object-contain" />
            </span>
            <span className="lux-hero-badge__text">{t('landing.hero.badge')}</span>
          </div>
          <h1 
            className="lux-heading text-[#C5A059] text-4xl font-display font-medium tracking-tight sm:text-5xl lg:text-7xl lg:leading-[1.1] drop-shadow-2xl"
          >
            {t('landing.hero.title')}
          </h1>
          <p
            itemProp="description"
            className="mt-6 max-w-xl text-base font-light leading-relaxed text-[#F0E6D2] sm:text-lg"
          >
            {t('landing.hero.subtitle', { brand: BRAND.name })}
          </p>
          <div 
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start motion-reduce:animate-none motion-safe:animate-[reveal-blur_0.8s_cubic-bezier(0.16,1,0.3,1)_150ms_both]"
          >
            <Link
              to="/login"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-neutral-950/90 backdrop-blur-md border border-[#C5A059]/40 px-8 py-4 text-[#C5A059] font-medium tracking-widest uppercase text-sm transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)]"
            >
              Accedi
              <AuraIcon icon={ArrowRight} size="md" className="group-hover:translate-x-1 transition-all duration-300" />
            </Link>
          </div>
        </div>

        <div
          className="lux-hero-preview group relative hidden pt-10 lg:block lg:pt-0 motion-reduce:animate-none motion-safe:animate-[reveal-slide_0.9s_cubic-bezier(0.16,1,0.3,1)_200ms_both]"
        >
          <div className="lux-hero-preview__halo" aria-hidden />
          <div className="lux-hero-preview__shell">
            <div className="lux-hero-preview__ring" aria-hidden />
            <div className="rounded-[2rem] border border-[#D4AF37]/12 bg-[#050505]/95 p-5 lux-text-soft shadow-inner transition-colors duration-700 group-hover:border-[#D4AF37]/22">
              <div className="flex items-center justify-between rounded-2xl bg-[#0a0a0a] px-5 py-4 ring-1 ring-[#D4AF37]/10">
                <div className="flex items-center gap-3 text-sm font-bold tracking-wide lux-text-bright">
                  <img src="/brand/aura-syncro-logo-new.png" alt="" className="h-5 w-5 object-contain" />
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
