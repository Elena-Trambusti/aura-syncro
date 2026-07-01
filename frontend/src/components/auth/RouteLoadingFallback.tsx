import { useLocation } from 'react-router-dom'
import AuthLoadingScreen from './AuthLoadingScreen'

const LANDING_PATHS = new Set(['/', '/it', '/es', '/es-cn'])

/** Evita "common.loading" sui bot durante il lazy-load delle rotte pubbliche marketing. */
export default function RouteLoadingFallback() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '') || '/'
  if (LANDING_PATHS.has(path)) return null
  return <AuthLoadingScreen />
}
