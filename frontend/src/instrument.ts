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
    enabled: import.meta.env.PROD, // Solo in produzione
    debug: false,
    ...(useTunnel ? { tunnel: `${resolveApiBaseUrl()}/sentry-tunnel` } : {}),
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 0.1 conservativo per non erodere quota
    sendDefaultPii: false, // Disabilita default PII
    beforeSend(event) {
      // Filtro password e dati sensibili
      if (event.request && event.request.data) {
        try {
          const data = typeof event.request.data === 'string' ? JSON.parse(event.request.data) : event.request.data;
          if (data && typeof data === 'object' && 'password' in data) {
            data.password = '[FILTERED]';
            event.request.data = JSON.stringify(data);
          }
        } catch (e) {}
      }
      return event;
    }
  })

  if (import.meta.env.DEV) {
    console.info('[Sentry] Inizializzato ma silenziato in DEV', { dsnHost: new URL(dsn).host })
  }
} else if (import.meta.env.DEV) {
  console.warn('[Sentry] VITE_SENTRY_DSN mancante in frontend/.env')
}

export { Sentry }
