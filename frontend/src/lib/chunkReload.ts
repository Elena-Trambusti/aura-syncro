const RELOAD_KEY = 'aura-chunk-reload-ts'
/** Evita loop di ricarica se il chunk manca anche dopo il reload. */
const RELOAD_COOLDOWN_MS = 30_000

export function isChunkLoadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(message)
}

/**
 * Dopo un deploy i chunk della versione precedente non esistono più: una pagina
 * aperta prima del deploy fallisce al primo import lazy. Un reload carica la
 * versione nuova. Ritorna true se il reload è stato avviato.
 */
export function reloadForStaleChunk(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
