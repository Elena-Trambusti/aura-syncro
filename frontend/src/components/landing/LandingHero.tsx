import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Zap, BarChart3, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BRAND } from '../../lib/brand'
import { useAuth } from '../../contexts/AuthContext'
import { resolveDemoMarket } from '../../lib/demoAccounts'

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
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-20 h-[600px] w-[600px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute top-1/4 -right-32 h-[700px] w-[700px] rounded-full bg-orange-500/15 blur-[140px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div 
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-aura-gold/20 bg-aura-gold/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-aura-gold backdrop-blur-md"
            style={{ animation: 'reveal-blur 1.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('landing.hero.badge')}
          </div>
          <h1 
            className="text-4xl font-display font-medium tracking-tight sm:text-5xl lg:text-7xl lg:leading-[1.1] text-white drop-shadow-2xl"
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
            <Link
              to="/register"
              className="relative overflow-hidden inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-8 py-4 text-xs uppercase tracking-[0.15em] font-bold text-black shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(212,175,55,0.6)] group ring-1 ring-white/40"
            >
              <div className="absolute inset-0 w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer-sweep_3s_ease-in-out_infinite]" />
              <span className="relative">{t('landing.hero.ctaPrimary')}</span>
              <ArrowRight className="relative h-4 w-4" />
            </Link>
            <button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl px-8 py-4 text-xs uppercase tracking-[0.15em] font-bold text-white transition-all duration-500 hover:-translate-y-1 hover:bg-white/10 hover:border-aura-gold/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]"
            >
              {isDemoLoading ? <Loader2 className="h-4 w-4 animate-spin text-aura-gold" /> : <Zap className="h-4 w-4 text-aura-gold" />}
              {t('landing.hero.ctaDemo')}
            </button>
          </div>
        </div>

        <div 
          className="relative pt-10 lg:pt-0"
          style={{ animation: 'reveal-slide 1.4s cubic-bezier(0.16, 1, 0.3, 1) both', animationDelay: '600ms' }}
        >
          <div className="rounded-[2.5rem] border border-white/[0.04] bg-gradient-to-b from-white/[0.05] to-transparent p-6 shadow-[0_20px_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl ring-1 ring-white/5">
            <div className="rounded-[2rem] border border-white/[0.03] bg-[#050505]/80 p-5 text-slate-100 shadow-inner backdrop-blur-md">
              <div className="flex items-center justify-between rounded-2xl bg-[#0a0a0a] px-5 py-4 ring-1 ring-white/[0.02]">
                <div className="flex items-center gap-3 text-sm font-bold tracking-wide">
                  <Zap className="h-4 w-4 text-aura-gold" />
                  {BRAND.name}
                </div>
                <span className="rounded-full border border-aura-gold/20 bg-aura-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-aura-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                  Live
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-white/[0.02] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('landing.hero.previewKpi1')}</p>
                  <p className="mt-2 text-3xl font-display font-medium text-white">+18%</p>
                </div>
                <div className="rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-white/[0.02] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('landing.hero.previewKpi2')}</p>
                  <p className="mt-2 text-3xl font-display font-medium text-white">124</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-[#0a0a0a] p-5 ring-1 ring-white/[0.02]">
                <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <BarChart3 className="h-3.5 w-3.5" />
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
