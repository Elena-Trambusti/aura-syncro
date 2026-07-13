/**
 * Sentry — inizializzazione differita e solo con consenso cookie «tutti».
 */
import type * as SentryTypes from '@sentry/react'
import { resolveApiBaseUrl } from './lib/backendUrl'
import { hasAnalyticsConsent } from './lib/cookieConsent'
import { redactSensitiveFields } from './lib/sensitiveFields'

const dsn = import.meta.env.VITE_SENTRY_DSN

let sentryModule: typeof SentryTypes | null = null
let initPromise: Promise<typeof SentryTypes | null> | null = null

function initSentry(): Promise<typeof SentryTypes | null> {
  if (!dsn || !import.meta.env.PROD || !hasAnalyticsConsent()) return Promise.resolve(null)
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

/** Chiamare dopo consenso analytics o al bootstrap se già presente. */
export function bootstrapSentryIfConsented(): void {
  if (!hasAnalyticsConsent()) return
  void initSentry()
}

if (typeof window !== 'undefined') {
  bootstrapSentryIfConsented()
  window.addEventListener('aura-cookie-consent-change', () => {
    if (hasAnalyticsConsent()) bootstrapSentryIfConsented()
  })
} else if (import.meta.env.DEV && !dsn) {
  console.warn('[Sentry] VITE_SENTRY_DSN mancante in frontend/.env')
}

export const Sentry = {
  captureException(error: unknown, context?: Record<string, unknown>) {
    void initSentry().then((mod) => mod?.captureException(error, context))
  },
}
