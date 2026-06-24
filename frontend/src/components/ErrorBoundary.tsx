import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Sentry } from '../instrument'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-navy-surface/50 p-6">
          <div className="max-w-md rounded-xl premium-card p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-500" aria-hidden />
            <h1 className="text-lg font-bold text-pietra">Si è verificato un errore</h1>
            <p className="mt-2 text-sm text-fumo">
              Ricarica la pagina. Se il problema persiste, contatta il supporto Aura Syncro.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-aura-gold px-4 py-2 text-sm font-semibold text-white hover:bg-aura-gold-light"
            >
              Ricarica
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
