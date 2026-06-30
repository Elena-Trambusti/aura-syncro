import { toast } from '@/lib/toast'

/**
 * Test Sentry (step 3 wizard) — solo in sviluppo.
 */
export default function SentryTestButton() {
  if (!import.meta.env.DEV) return null

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          const Sentry = await import('@sentry/react')
          const err = new Error('This is your first error!')
          const eventId = Sentry.captureException(err)
          const sent = await Sentry.flush(5000)
          if (sent && eventId) {
            toast.success(`Errore inviato a Sentry (${eventId.slice(0, 8)}…)`)
            console.info('[Sentry] Verifica completata', { eventId })
          } else {
            toast.error('Sentry non ha inviato l\'evento — controlla console e ad-blocker')
          }
        })()
      }}
      className="fixed bottom-4 left-4 z-[9999] rounded-lg border border-red-500/40 bg-red-950/90 px-3 py-2 text-xs font-semibold text-red-200 shadow-lg hover:bg-red-900"
      title="Test Sentry — step 3 del wizard"
    >
      Break the world
    </button>
  )
}
