import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Zap, BarChart3, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BRAND } from '../../lib/brand'
import { useAuth } from '../../contexts/AuthContext'

export default function LandingHero() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const handleDemoLogin = async () => {
    try {
      setIsDemoLoading(true)
      // Usiamo le credenziali demo esistenti del seed di Aura Syncro
      await login('admin@demo.it', 'admin123')
      navigate('/dashboard')
    } catch (error) {
      toast.error('Errore avvio demo: impossibile collegarsi.')
      console.error(error)
    } finally {
      setIsDemoLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden bg-transparent px-4 pb-20 pt-12 sm:px-6 sm:pb-28 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-20 h-[600px] w-[600px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute top-1/4 -right-32 h-[700px] w-[700px] rounded-full bg-orange-500/15 blur-[140px]" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-500 backdrop-blur-md opacity-0 animate-[fade-in-up_1s_ease-out_forwards]">
            <Sparkles className="h-3.5 w-3.5" />
            {t('landing.hero.badge')}
          </div>
          <h1 className="text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl lg:leading-[1.05] bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-400 opacity-0 animate-[fade-in-up_1s_ease-out_150ms_forwards]">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg opacity-0 animate-[fade-in-up_1s_ease-out_300ms_forwards]">
            {t('landing.hero.subtitle', { brand: BRAND.name })}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row opacity-0 animate-[fade-in-up_1s_ease-out_450ms_forwards]">
            <Link
              to="/register"
              className="relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] group"
            >
              <div className="absolute inset-0 w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer-sweep_3s_ease-in-out_infinite]" />
              <span className="relative">{t('landing.hero.ctaPrimary')}</span>
              <ArrowRight className="relative h-4 w-4" />
            </Link>
            <button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
            >
              {isDemoLoading ? <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> : <Zap className="h-4 w-4 text-amber-500" />}
              Entra nella Demo Live (Senza Registrazione)
            </button>
          </div>
        </div>

        <div className="relative animate-[float_6s_ease-in-out_infinite]">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 shadow-[0_8_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl">
            <div className="rounded-2xl border border-white/5 bg-slate-950/80 p-4 text-slate-100 shadow-inner backdrop-blur-md">
              <div className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="h-4 w-4 text-amber-400" />
                  {BRAND.name}
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  Live
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">{t('landing.hero.previewKpi1')}</p>
                  <p className="mt-1 text-xl font-bold text-white">+18%</p>
                </div>
                <div className="rounded-xl bg-slate-800 p-3">
                  <p className="text-xs text-slate-400">{t('landing.hero.previewKpi2')}</p>
                  <p className="mt-1 text-xl font-bold text-white">124</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-slate-800 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {t('landing.hero.previewChart')}
                </div>
                <div className="flex h-24 items-end gap-2">
                  {[35, 55, 40, 68, 72, 58, 80].map((height, idx) => (
                    <div
                      key={idx}
                      className="flex-1 rounded-md bg-gradient-to-t from-amber-500 to-orange-400"
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
