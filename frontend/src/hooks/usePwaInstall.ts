import { useCallback, useEffect, useRef, useState } from 'react'
import { isInstalledAppShell, isStandaloneApp } from '../lib/standaloneApp'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneApp() || isInstalledAppShell())

  useEffect(() => {
    const embedded = isStandaloneApp() || isInstalledAppShell()
    setIsStandalone(embedded)
    if (embedded) {
      try {
        localStorage.setItem('pwa-install-hint-dismissed', '1')
      } catch {
        /* ignore */
      }
    }

    const onBeforeInstall = (event: Event) => {
      if (isStandaloneApp() || isInstalledAppShell()) return
      event.preventDefault()
      deferredRef.current = event as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    const onDisplayMode = () => {
      setIsStandalone(isStandaloneApp() || isInstalledAppShell())
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onDisplayMode)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onDisplayMode)
    }
  }, [])

  const install = useCallback(async (): Promise<boolean> => {
    const prompt = deferredRef.current
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredRef.current = null
    setCanInstall(false)
    if (outcome === 'accepted') setIsStandalone(true)
    return outcome === 'accepted'
  }, [])

  return { canInstall, isStandalone, install }
}
