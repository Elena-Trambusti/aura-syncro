import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './i18n'
import App from './App'
import './index.css'
import { queryClient } from './lib/queryClient'
import ErrorBoundary from './components/ErrorBoundary'

Sentry.init({
  dsn: "https://f0fb781948d080042328e24e820df515@o4511618999451648.ingest.de.sentry.io/4511619023175760",
  tracesSampleRate: 1.0,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
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
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
