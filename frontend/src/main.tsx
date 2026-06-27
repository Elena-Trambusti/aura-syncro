import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from 'react-hot-toast'
import './i18n'
import App from './App'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { queryClient, idbPersister } from './lib/queryClient'
import ErrorBoundary from './components/ErrorBoundary'
import SentryTestButton from './components/SentryTestButton'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: idbPersister, maxAge: 1000 * 60 * 60 * 24 }}>
        <App />
        <Analytics />
        <SentryTestButton />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1A1D26',
              color: '#F4F4F5',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            },
            success: { iconTheme: { primary: '#D4AF37', secondary: '#0B0E14' } },
            error: { iconTheme: { primary: '#f87171', secondary: '#0B0E14' } },
          }}
        />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
