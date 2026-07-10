import './instrument'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootstrapI18nSync } from './i18n/bootstrap'
import { bootstrapStandaloneApp } from './lib/bootstrapStandalone'
import { hidePwaBootShell, installPwaResetGlobal, purgePwaRuntimeCaches } from './lib/pwaBoot'
import { isInstalledAppShell } from './lib/standaloneApp'
import App from './App'
import './index.css'
import AppProviders from './components/AppProviders'
import DeferredMetrics from './components/DeferredMetrics'
import AuraSonner from './components/AuraSonner'
import ErrorBoundary from './components/ErrorBoundary'

installPwaResetGlobal()

if (isInstalledAppShell()) {
  void purgePwaRuntimeCaches()
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('#root missing')
}

const root = createRoot(rootEl)

bootstrapI18nSync()
bootstrapStandaloneApp()

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

requestAnimationFrame(() => {
  hidePwaBootShell()
})
