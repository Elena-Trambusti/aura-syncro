/**
 * Aura Syncro — Software Gestionale per Ristoranti
 * Copyright (c) 2026 Elena Trambusti. Tutti i diritti riservati.
 * Contatto: elenatrambusti2024@gmail.com
 * Software proprietario e riservato. Vedere LICENSE per i dettagli.
 * CONFIDENZIALE — NON DISTRIBUIRE
 */
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { authRouter } from './routes/auth'
import { tablesRouter } from './routes/tables'
import { menuRouter } from './routes/menu'
import { ordersRouter } from './routes/orders'
import { reservationsRouter } from './routes/reservations'
import { customersRouter } from './routes/customers'
import { staffRouter } from './routes/staff'
import { inventoryRouter } from './routes/inventory'
import { analyticsRouter } from './routes/analytics'
import { restaurantRouter } from './routes/restaurant'
import { loyaltyRouter } from './routes/loyalty'
import { marketingRouter } from './routes/marketing'
import { reportsRouter } from './routes/reports'
import { waitlistRouter } from './routes/waitlist'
import { paymentsRouter } from './routes/payments'
import { checkoutRouter } from './routes/checkout'
import { stripeWebhookRouter } from './routes/webhooks/stripe'
import { publicRouter } from './routes/public'
import { adminRouter } from './routes/admin'
import { aiRouter } from './routes/ai'
import { pushRouter } from './routes/push'
import { sentryTunnelRouter } from './routes/sentryTunnel'
import invoicesRouter from './routes/invoices'
import { cashRouter } from './routes/cash'
import { AuthRequest, authenticate } from './middleware/auth'
import { requireTenantContext } from './middleware/tenantContext'
import { requireDashboardAccess } from './middleware/dashboardAccess'
import { attachSentryTenantScope } from './middleware/sentryTenant'
import { requireProPlan } from './middleware/planTier'
import { prisma } from './lib/prisma'
import { buildDashboardSummary } from './lib/analyticsSummary'
import { getTenantCache, setTenantCacheBounded } from './lib/tenantCache'
import { runAllMarketingJobs } from './lib/marketingSend'
import { errorHandler } from './middleware/errorHandler'
import { requirePermission } from './middleware/permissions'
import { setupSocketHandlers } from './socket/handlers'
import { validateEnv } from './lib/env'
import { getVapidPublicKey } from './lib/webPush'
import { globalApiLimiter, vapidPublicKeyLimiter } from './middleware/rateLimit'
import { startInvoicePoller } from './lib/invoicePoller'
import { serializeDecimals } from './lib/money'
import { runTelegramDailyAlerts } from './lib/telegramScheduler'
import { redactSensitiveFields } from './lib/sensitiveFields'

// In produzione (DigitalOcean) le variabili sono iniettate dalla piattaforma;
// in locale carichiamo backend/.env tramite dotenv.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

// Inizializza Sentry prima di qualsiasi rotta o middleware
// Profiling Sentry disabilitato di default: su istanze piccole può causare OOM durante transazioni pesanti (finalize).
const sentryProfilingEnabled = process.env.SENTRY_ENABLE_PROFILING === 'true'

Sentry.init({
  dsn: process.env.SENTRY_BACKEND_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1, // Conservativo per preservare la quota
  profilesSampleRate: sentryProfilingEnabled ? 0.1 : 0,
  integrations: sentryProfilingEnabled ? [nodeProfilingIntegration()] : [],
  sendDefaultPii: false, // Disabilita invio IP e intestazioni PII per default
  beforeSend(event) {
    if (event.request && event.request.data) {
      try {
        const data = typeof event.request.data === 'string' ? JSON.parse(event.request.data) : event.request.data;
        event.request.data = JSON.stringify(redactSensitiveFields(data));
      } catch {
        delete event.request?.data
      }
    }
    return event;
  }
})

validateEnv()

import { isOriginAllowed } from './lib/cors'

const app = express()
const httpServer = createServer(app)

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}))

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    callback(null, isOriginAllowed(origin))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Restaurant-Id', 'X-Admin-Key', 'x-idempotency-key'],
}

export const io = new Server(httpServer, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
})

app.use(cors(corsOptions))
app.use(globalApiLimiter)

// Webhook Stripe canonico: body grezzo prima di express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))
// Tunnel Sentry — body grezzo, prima di express.json()
app.use('/api/sentry-tunnel', sentryTunnelRouter)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/** Prisma.Decimal → number nelle risposte JSON (compat frontend). */
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res)
  res.json = (body: unknown) => {
    if (body === undefined) return originalJson(body)
    return originalJson(serializeDecimals(body))
  }
  next()
})

/** Chiave VAPID pubblica — endpoint pubblico (necessaria prima della subscribe push) */
app.get('/api/push/vapid-public-key', vapidPublicKeyLimiter, (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() })
})

// Routes pubbliche
app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/admin', adminRouter)

// Middleware comune: auth → tenant context → dashboard access
const apiGuard = [authenticate, requireTenantContext, attachSentryTenantScope, requireDashboardAccess]

app.get('/api/analytics/summary', ...apiGuard, requirePermission('analytics.read'), async (req: AuthRequest, res) => {
  try {
    const restaurantId = req.restaurantId
    if (!restaurantId) {
      res.status(401).json({ error: 'Non autenticato' })
      return
    }
    const cacheKey = `${restaurantId}:dashboard:summary`
    const cached = getTenantCache<Awaited<ReturnType<typeof buildDashboardSummary>>>(cacheKey)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.json(cached)
      return
    }
    const summary = await buildDashboardSummary(restaurantId)
    setTenantCacheBounded(cacheKey, summary, 60_000)
    res.setHeader('X-Cache', 'MISS')
    res.json(summary)
  } catch {
    res.status(500).json({ error: 'Errore caricamento dashboard' })
  }
})

// Routes protette — sbarramento centralizzato su tier operativo
app.use('/api/restaurant', authenticate, requireTenantContext, restaurantRouter)
app.use('/api/push', ...apiGuard, pushRouter)
app.use('/api/tables', ...apiGuard, tablesRouter)
app.use('/api/menu', ...apiGuard, menuRouter)
app.use('/api/orders', ...apiGuard, ordersRouter)
app.use('/api/invoices', ...apiGuard, requireProPlan, invoicesRouter)
app.use('/api/reservations', ...apiGuard, reservationsRouter)
app.use('/api/cash', ...apiGuard, cashRouter)
app.use('/api/customers', ...apiGuard, requireProPlan, customersRouter)
app.use('/api/staff', ...apiGuard, staffRouter)
app.use('/api/inventory', ...apiGuard, inventoryRouter)
app.use('/api/analytics', ...apiGuard, requireProPlan, analyticsRouter)
app.use('/api/loyalty', ...apiGuard, requireProPlan, loyaltyRouter)
app.use('/api/marketing', ...apiGuard, requireProPlan, marketingRouter)
app.use('/api/reports', ...apiGuard, reportsRouter)
app.use('/api/waitlist', ...apiGuard, waitlistRouter)
// Pagamenti: checkout e webhook sono pubblici, /overview è protetta
app.use('/api/payments', paymentsRouter)
app.use('/api/webhooks/stripe', stripeWebhookRouter)
app.use('/api/checkout', authenticate, requireTenantContext, checkoutRouter)
app.use('/api/ai', ...apiGuard, requireProPlan, aiRouter)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ready',
      db: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[health/ready] DB ping failed:', err)
    res.status(503).json({
      status: 'not_ready',
      db: 'error',
      timestamp: new Date().toISOString(),
    })
  }
})

// Gestore Errori Sentry (deve essere DOPO le rotte ma PRIMA del gestore errori custom)
Sentry.setupExpressErrorHandler(app)

app.use(errorHandler)

setupSocketHandlers(io)

const PORT = process.env.PORT || 3001

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERRORE CRITICO: La porta ${PORT} è già in uso.`)
    console.error(`💡 Soluzione: Probabilmente hai già avviato il backend in un'altra finestra del terminale, oppure un altro programma sta usando la porta ${PORT}.`)
    console.error(`Arresta l'altro processo e riavvia il server.\n`)
    process.exit(1)
  } else {
    console.error('Errore del server:', err)
  }
})

httpServer.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`)
  console.log(`📦 Database: ${process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL (Supabase)' : 'SQLite'}`)
  console.log(`🔌 WebSocket pronto`)

  // Avvia il poller per lo stato SDI di Aruba
  if (process.env.NODE_ENV !== 'test') {
    startInvoicePoller()
  }

  const schedulerMs = Number(process.env.MARKETING_SCHEDULER_MS || 3600_000)
  setInterval(async () => {
    try {
      const result = await runAllMarketingJobs()
      if (result.campaigns > 0 || result.automations > 0) {
        console.info('[scheduler] Marketing:', result.campaigns, 'campagne,', result.automations, 'automazioni')
      }
    } catch (err) {
      console.error('[scheduler] Errore marketing:', err)
    }
  }, schedulerMs)

  // Controllo orario per l'invio degli alert Telegram
  setInterval(() => {
    runTelegramDailyAlerts().catch(console.error)
  }, 60 * 60 * 1000) // Controlla ogni ora

  setInterval(() => {
    import('./lib/stalePublicOrders')
      .then(({ cancelStalePublicPendingOrders }) => cancelStalePublicPendingOrders())
      .then(n => {
        if (n > 0) console.info('[scheduler] Ordini guest PENDING scaduti annullati:', n)
      })
      .catch(err => console.error('[scheduler] stale public orders:', err))
  }, 15 * 60 * 1000)
})
