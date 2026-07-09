import { useEffect, useState } from 'react'

/** Sottoscrizione a matchMedia con sync iniziale e cleanup. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}

/** Layout sala mobile/tablet (< lg): lista + toggle piantina. */
export const TABLE_MOBILE_LAYOUT_QUERY = '(max-width: 1023px)'

/** Telefono stretto: lista predefinita, toolbar compatta. */
export const TABLE_PHONE_QUERY = '(max-width: 767px)'
