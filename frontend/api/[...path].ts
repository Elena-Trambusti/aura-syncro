/**
 * Proxy Vercel → backend DigitalOcean.
 * Imposta BACKEND_URL su Vercel (es. https://aura-syncro-xxxxx.ondigitalocean.app)
 */
type VercelRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  query: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  json: (data: unknown) => void
  send: (data: string) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const backend = process.env.BACKEND_URL
  if (!backend) {
    res.status(503).json({
      error: 'BACKEND_URL non configurato su Vercel. Aggiungi l\'URL del backend DigitalOcean.',
    })
    return
  }

  const pathParts = req.query.path
  const subPath = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts ?? '')
  const urlObj = new URL(req.url ?? '/', 'http://localhost')
  const targetUrl = `${backend.replace(/\/$/, '')}/api/${subPath}${urlObj.search}`

  const headers: Record<string, string> = {}
  for (const name of ['authorization', 'content-type', 'x-restaurant-id']) {
    const value = req.headers[name]
    if (typeof value === 'string') headers[name] = value
  }

  let body: string | undefined
  if (req.method && !['GET', 'HEAD'].includes(req.method)) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
    if (!headers['content-type']) headers['content-type'] = 'application/json'
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    })

    const text = await upstream.text()
    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value)
      }
    })
    res.send(text)
  } catch {
    res.status(502).json({
      error: 'Impossibile contattare il backend. Verifica che l\'app DigitalOcean sia attiva.',
    })
  }
}
