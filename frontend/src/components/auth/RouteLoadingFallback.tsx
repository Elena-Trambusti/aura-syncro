import { useLocation } from 'react-router-dom'
import AuthLoadingScreen from './AuthLoadingScreen'
import PageSkeleton from '../ui/PageSkeleton'

const LANDING_PATHS = new Set(['/', '/it', '/es', '/es-cn'])
const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password'])

/** Fallback dimensionato — evita CLS quando i chunk lazy caricano. */
export default function RouteLoadingFallback() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '') || '/'
  if (LANDING_PATHS.has(path)) {
    return (
      <div className="landing-page relative min-h-[100dvh] bg-[#020202]" aria-hidden>
        <div className="h-[calc(3.25rem+env(safe-area-inset-top,0px))]" />
        <div className="mx-auto max-w-6xl px-4 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] pb-24 sm:px-6">
          <div className="mb-8 h-11 w-56 max-w-full rounded-full bg-white/[0.04]" />
          <div className="min-h-[clamp(4.5rem,12vw,7.5rem)] max-w-2xl rounded-lg bg-white/[0.03]" />
          <div className="mt-7 min-h-[4.5rem] max-w-lg rounded-lg bg-white/[0.02]" />
        </div>
      </div>
    )
  }
  if (AUTH_PATHS.has(path)) return <AuthLoadingScreen />
  return (
    <div className="p-4 sm:p-6">
      <PageSkeleton variant="kpi" count={4} className="mb-6" />
      <PageSkeleton variant="list" count={5} />
    </div>
  )
}
