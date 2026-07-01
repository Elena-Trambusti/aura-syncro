import { lazy, type ComponentType } from 'react'

/** Lazy route con retry — evita ErrorBoundary su chunk stale dopo deploy o glitch di rete. */
export function lazyRoute<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await factory()
      } catch (err) {
        lastErr = err
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)))
        }
      }
    }
    throw lastErr
  })
}
