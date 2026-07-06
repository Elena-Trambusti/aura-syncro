import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, BarChart3 } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { BRAND, BRAND_LOGO_DISPLAY_SRC } from '../../lib/brand'
import DemoBookingModal from './DemoBookingModal'
import LiveDemoButton from './LiveDemoButton'

export default function LandingHero() {
  const { t } = useTranslation()
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  return (
    <section
      className="relative overflow-hidden bg-transparent px-4 pb-24 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pb-32 sm:pt-[calc(6.5rem+env(safe-area-inset-top,0px))]"
      itemScope
      itemType="https://schema.org/SoftwareApplication"
    >
      <meta itemProp="name" content={BRAND.name} />
      <link itemProp="url" href="https://www.aurasyncro.com/" />
      <meta itemProp="applicationCategory" content="BusinessApplication" />
      <meta itemProp="operatingSystem" content="Web" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="lux-hero-copy text-center lg:text-left">
          <div className="lux-hero-badge motion-reduce:animate-none motion-safe:animate-[reveal-blur_0.8s_cubic-bezier(0.16,1,0.3,1)_both]">
            <img
              src={BRAND_LOGO_DISPLAY_SRC}
              alt=""
              className="lux-hero-badge__logo"
              width={44}
              height={44}
              decoding="async"
              aria-hidden
            />
            <span className="lux-hero-badge__text">{t('landing.hero.badge')}</span>
          </div>

          <h1 className="lux-heading lux-hero-title mt-8 text-4xl sm:text-5xl lg:text-[4.25rem] xl:text-7xl">
            {t('landing.hero.headline')}
          </h1>

          <div className="lux-hero-rule mx-auto lg:mx-0" aria-hidden />

          <p
            itemProp="description"
            className="lux-hero-sub mx-auto mt-7 max-w-lg text-base sm:text-lg lg:mx-0 lg:max-w-xl"
          >
            {t('landing.hero.subheadline')}
          </p>
        </div>

        <div className="lux-hero-preview group relative hidden pt-10 lg:block lg:pt-0 motion-reduce:animate-none motion-safe:animate-[reveal-slide_0.9s_cubic-bezier(0.16,1,0.3,1)_200ms_both]">
          <div className="lux-hero-preview__halo" aria-hidden />
          <div className="lux-hero-preview__shell">
            <div className="lux-hero-preview__ring" aria-hidden />
            <div className="rounded-[2rem] border border-[#D4AF37]/12 bg-[#050505]/95 p-5 lux-text-soft shadow-inner transition-colors duration-700 group-hover:border-[#D4AF37]/22">
              <div className="flex items-center justify-between rounded-2xl bg-[#0a0a0a] px-5 py-4 ring-1 ring-[#D4AF37]/10">
                <div className="flex items-center gap-3 text-sm font-bold tracking-wide lux-text-bright">
                  <img src={BRAND_LOGO_DISPLAY_SRC} alt="" className="h-5 w-5 object-contain" width={20} height={20} decoding="async" />
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

      <div className="mx-auto mt-11 flex max-w-6xl flex-col items-center justify-center gap-4 px-4 motion-reduce:animate-none motion-safe:animate-[reveal-blur_0.8s_cubic-bezier(0.16,1,0.3,1)_150ms_both] sm:flex-row sm:px-6">
        <button
          type="button"
          onClick={() => setIsDemoModalOpen(true)}
          className="lux-hero-cta group w-full sm:w-auto"
        >
          {t('landing.hero.ctaDemoPrivate')}
          <AuraIcon icon={ArrowRight} size="md" className="transition-transform duration-300 group-hover:translate-x-1" />
        </button>
        <LiveDemoButton />
      </div>

      <DemoBookingModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </section>
  )
}
