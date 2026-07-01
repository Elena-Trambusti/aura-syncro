import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageMeta } from './usePageMeta'
import { absoluteSiteUrl } from './siteUrl'

/** Meta tag per pagine pubbliche (prezzi, contatti, legal, auth). */
export function usePublicPageMeta(title: string, description: string) {
  const { pathname } = useLocation()

  usePageMeta(title, description, {
    canonicalPath: pathname,
  })

  useEffect(() => {
    document.getElementById('static-landing-seo')?.setAttribute('hidden', '')
    return () => {
      document.getElementById('static-landing-seo')?.removeAttribute('hidden')
    }
  }, [])
}

export { absoluteSiteUrl }
