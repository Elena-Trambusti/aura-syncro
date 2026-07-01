import { useEffect } from 'react'
import { absoluteSiteUrl, OG_IMAGE_URL } from './siteUrl'

export type PageMetaOptions = {
  canonicalPath?: string
  ogImage?: string
  ogLocale?: string
  htmlLang?: string
  hreflangAlternates?: ReadonlyArray<{ hreflang: string; path: string }>
}

function upsertMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    document.head.appendChild(el)
  }
  el.content = content
  return el
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  const selector = extra?.hreflang
    ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]`
    : `link[rel="${rel}"]`
  let el = document.querySelector(selector) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        el.setAttribute(key, value)
      }
    }
    document.head.appendChild(el)
  }
  el.href = href
  return el
}

export function usePageMeta(title: string, description: string, options: PageMetaOptions = {}) {
  const {
    canonicalPath = '/',
    ogImage = OG_IMAGE_URL,
    ogLocale = 'it_IT',
    htmlLang = 'it',
    hreflangAlternates,
  } = options

  useEffect(() => {
    const prevTitle = document.title
    const prevHtmlLang = document.documentElement.lang
    document.title = title
    document.documentElement.lang = htmlLang

    const descriptionMeta = upsertMeta('meta[name="description"]', { name: 'description' }, description)
    const prevDescription = descriptionMeta.content

    upsertMeta('meta[name="robots"]', { name: 'robots' }, 'index, follow')

    const canonicalUrl = absoluteSiteUrl(canonicalPath)
    const canonical = upsertLink('canonical', canonicalUrl)
    const prevCanonical = canonical.href

    const ogPairs: Array<[string, string]> = [
      ['og:title', title],
      ['og:description', description],
      ['og:url', canonicalUrl],
      ['og:type', 'website'],
      ['og:site_name', 'Aura Syncro'],
      ['og:locale', ogLocale],
      ['og:image', ogImage],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', title],
    ]
    const prevOg: Record<string, string> = {}
    for (const [property, content] of ogPairs) {
      const el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
      prevOg[property] = el?.content ?? ''
      upsertMeta(`meta[property="${property}"]`, { property }, content)
    }

    const twitterPairs: Array<[string, string]> = [
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', title],
      ['twitter:description', description],
      ['twitter:image', ogImage],
    ]
    const prevTwitter: Record<string, string> = {}
    for (const [name, content] of twitterPairs) {
      const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      prevTwitter[name] = el?.content ?? ''
      upsertMeta(`meta[name="${name}"]`, { name }, content)
    }

    const hreflangEls: HTMLLinkElement[] = []
    if (hreflangAlternates?.length) {
      for (const alt of hreflangAlternates) {
        hreflangEls.push(upsertLink('alternate', absoluteSiteUrl(alt.path), { hreflang: alt.hreflang }))
      }
    }

    return () => {
      document.title = prevTitle
      document.documentElement.lang = prevHtmlLang
      descriptionMeta.content = prevDescription
      canonical.href = prevCanonical
      for (const [property, content] of Object.entries(prevOg)) {
        if (content) upsertMeta(`meta[property="${property}"]`, { property }, content)
      }
      for (const [name, content] of Object.entries(prevTwitter)) {
        if (content) upsertMeta(`meta[name="${name}"]`, { name }, content)
      }
      for (const el of hreflangEls) {
        el.remove()
      }
    }
  }, [title, description, canonicalPath, ogImage, ogLocale, htmlLang, hreflangAlternates])
}
