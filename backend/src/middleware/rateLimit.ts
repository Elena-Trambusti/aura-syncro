import rateLimit from 'express-rate-limit'

const message = (text: string) => ({ error: text, code: 'RATE_LIMITED' })

export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppi tentativi di login. Riprova tra 15 minuti.'),
})

export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe registrazioni da questo indirizzo. Riprova tra un\'ora.'),
})

export const authForgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste di reset password. Riprova tra un\'ora.'),
})

export const authResetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste di reimpostazione password. Riprova tra un\'ora.'),
})

export const sentryTunnelLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste al tunnel di monitoraggio. Riprova tra un minuto.'),
})

export const campaignSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const auth = req as { restaurantId?: string }
    return auth.restaurantId ?? req.ip ?? 'unknown'
  },
  message: message('Limite invii campagne raggiunto. Riprova tra un\'ora.'),
})

export const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste. Riprova tra qualche minuto.'),
})

export const publicCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste di pagamento. Riprova tra qualche minuto.'),
})

export const depositLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste di caparra. Riprova tra qualche minuto.'),
})

export const publicReservationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const slug = typeof req.body?.slug === 'string' ? req.body.slug : 'unknown'
    return `${req.ip ?? 'unknown'}:${slug}`
  },
  message: message('Troppe prenotazioni. Riprova tra qualche minuto.'),
})

export const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.ip ?? 'unknown',
  message: message('Troppe richieste admin. Riprova tra un minuto.'),
})

export const publicMenuLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    const slug = typeof req.params?.slug === 'string' ? req.params.slug : 'unknown'
    return `${req.ip ?? 'unknown'}:${slug}`
  },
  message: message('Troppe richieste al menu. Riprova tra un minuto.'),
})

export const vapidPublicKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Troppe richieste. Riprova tra un minuto.'),
})

/** Limite generale API (per IP) — esclude webhook Stripe */
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: req =>
    req.path.startsWith('/api/webhooks/')
    || req.path.startsWith('/api/sentry-tunnel'),
  message: message('Troppe richieste. Riprova tra un minuto.'),
})
