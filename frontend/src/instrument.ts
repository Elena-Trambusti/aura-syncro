/**
 * Sentry — deve essere importato per primo in main.tsx (prima di React).
 * @see https://docs.sentry.io/platforms/javascript/guides/react/
 */
import * as Sentry from '@sentry/react'
import { resolveApiBaseUrl } from './lib/backendUrl'

const dsn = import.meta.env.VITE_SENTRY_DSN

if (dsn) {
  const useTunnel = import.meta.env.PROD

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: true,
    debug: import.meta.env.DEV,
    ...(useTunnel ? { tunnel: `${resolveApiBaseUrl()}/sentry-tunnel` } : {}),
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    sendDefaultPii: false,
  })

  if (import.meta.env.DEV) {
    console.info('[Sentry] SDK attivo', { dsnHost: new URL(dsn).host })
  }
} else if (import.meta.env.DEV) {
  console.warn('[Sentry] VITE_SENTRY_DSN mancante in frontend/.env')
}

export { Sentry }
