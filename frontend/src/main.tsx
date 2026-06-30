import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootstrapI18n } from './i18n/bootstrap'
import App from './App'
import './index.css'
import AppProviders from './components/AppProviders'
import DeferredMetrics from './components/DeferredMetrics'
import AuraSonner from './components/AuraSonner'
import ErrorBoundary from './components/ErrorBoundary'
import SentryTestButton from './components/SentryTestButton'

void bootstrapI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProviders>
          <App />
          <DeferredMetrics />
          <AuraSonner />
          <SentryTestButton />
        </AppProviders>
      </ErrorBoundary>
    </StrictMode>,
  )
})
