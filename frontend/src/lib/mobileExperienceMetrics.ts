type MetricEvent = {
  name: 'long-task' | 'interaction-latency'
  value: number
  route: string
  ts: number
}

let started = false

function currentRoute(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname
}

function emitMetric(event: MetricEvent): void {
  if (!import.meta.env.PROD) {
    console.debug('[AuraMetrics]', event)
    return
  }
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(event)], { type: 'application/json' })
    navigator.sendBeacon('/api/metrics/mobile-experience', blob)
  }
}

/** Lightweight Android quality signals for release-gates (no external SDK). */
export function startMobileExperienceMetrics(): void {
  if (started || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return
  started = true

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = Math.round(entry.duration)
        if (duration < 120) continue
        emitMetric({
          name: 'long-task',
          value: duration,
          route: currentRoute(),
          ts: Date.now(),
        })
      }
    })
    longTaskObserver.observe({ type: 'longtask', buffered: true })
  } catch {
    // Longtask not supported on all browsers/devices.
  }

  try {
    const eventObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const latency = Math.round(entry.duration)
        if (latency < 120) continue
        emitMetric({
          name: 'interaction-latency',
          value: latency,
          route: currentRoute(),
          ts: Date.now(),
        })
      }
    })
    eventObserver.observe({ type: 'event', buffered: true } as PerformanceObserverInit)
  } catch {
    // Event timing API not supported on all browsers/devices.
  }
}
