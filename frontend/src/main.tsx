import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootstrapI18nSync } from './i18n/bootstrap'
import App from './App'
import './index.css'
import AppProviders from './components/AppProviders'
import DeferredMetrics from './components/DeferredMetrics'
import AuraSonner from './components/AuraSonner'
import ErrorBoundary from './components/ErrorBoundary'

const root = createRoot(document.getElementById('root')!)

bootstrapI18nSync()
root.render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
        <DeferredMetrics />
        <AuraSonner />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
