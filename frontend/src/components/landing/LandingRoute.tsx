import { useLayoutEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { applyLocale, normalizeLocaleCode } from '../../i18n/bootstrap'
import { useAuth } from '../../contexts/AuthContext'
import { isDemoUserEmail } from '../../lib/demoAccounts'
import { isStandaloneApp } from '../../lib/standaloneApp'
import { PWA_ROUTES } from '../../lib/pwaRoutes'

export default function LandingRoute({ children, forceLang }: { children: React.ReactNode, forceLang?: string }) {
  const { user, logout } = useAuth()

  useLayoutEffect(() => {
    const lang = normalizeLocaleCode(forceLang) ?? forceLang
    if (!lang) return
    void applyLocale(lang)
  }, [forceLang])

  // Solo al rientro sulla landing (es. da dashboard), non dopo login demo sulla stessa pagina.
  useLayoutEffect(() => {
    if (user && isDemoUserEmail(user.email)) {
      logout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // APK/TWA/WebView: redirect al login. In Chrome normale la landing resta visibile anche se l'app è stata installata in passato.
  if (isStandaloneApp()) {
    return <Navigate to={PWA_ROUTES.start} replace />
  }

  return <>{children}</>
}