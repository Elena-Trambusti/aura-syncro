/**
 * Sentry — inizializzazione differita per non bloccare il first paint.
 */
import type * as SentryTypes from '@sentry/react'
import { resolveApiBaseUrl } from './lib/backendUrl'
import { redactSensitiveFields } from './lib/sensitiveFields'

const dsn = import.meta.env.VITE_SENTRY_DSN

let sentryModule: typeof SentryTypes | null = null
let initPromise: Promise<typeof SentryTypes | null> | null = null

function initSentry(): Promise<typeof SentryTypes | null> {
  if (!dsn || !import.meta.env.PROD) return Promise.resolve(null)
  if (sentryModule) return Promise.resolve(sentryModule)
  if (initPromise) return initPromise

  initPromise = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      enabled: true,
      debug: false,
      tunnel: `${resolveApiBaseUrl()}/sentry-tunnel`,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.data) {
          try {
            const data =
              typeof event.request.data === 'string'
                ? JSON.parse(event.request.data)
                : event.request.data
            event.request.data = JSON.stringify(redactSensitiveFields(data))
          } catch {
            /* ignore */
          }
        }
        return event
      },
    })
    sentryModule = Sentry
    return Sentry
  })

  return initPromise
}

if (typeof window !== 'undefined' && dsn && import.meta.env.PROD) {
  const schedule = () => void initSentry()
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(schedule, { timeout: 4000 })
  } else {
    setTimeout(schedule, 2000)
  }
} else if (import.meta.env.DEV && !dsn) {
  console.warn('[Sentry] VITE_SENTRY_DSN mancante in frontend/.env')
}

export const Sentry = {
  captureException(error: unknown, context?: Record<string, unknown>) {
    void initSentry().then((mod) => mod?.captureException(error, context))
  },
}
