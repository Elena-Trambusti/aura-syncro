/**
 * Aura Syncro — Software Gestionale per Ristoranti
 * Copyright (c) 2026 Elena Trambusti. Tutti i diritti riservati.
 * Contatto: elenatrambusti2024@gmail.com
 * Software proprietario e riservato. Vedere LICENSE per i dettagli.
 * CONFIDENZIALE — NON DISTRIBUIRE
 */
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
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
import { AuthRequest, authenticate } from './middleware/auth'
import { requireDashboardAccess } from './middleware/dashboardAccess'
import { requireProPlan } from './middleware/planTier'
import { buildDashboardSummary } from './lib/analyticsSummary'
import { processScheduledCampaigns } from './lib/marketingSend'
import { errorHandler } from './middleware/errorHandler'
import { setupSocketHandlers } from './socket/handlers'
import { validateEnv } from './lib/env'
import { getVapidPublicKey } from './lib/webPush'

// In produzione (DigitalOcean) le variabili sono iniettate dalla piattaforma;
// in locale carichiamo backend/.env tramite dotenv.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

validateEnv()

import { isOriginAllowed } from './lib/cors'

const app = express()
const httpServer = createServer(app)

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    callback(null, isOriginAllowed(origin))
  },
  credentials: true,
}

export const io = new Server(httpServer, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
})

app.use(cors(corsOptions))

// Webhook Stripe: body grezzo (raw) prima di express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/** Chiave VAPID pubblica — endpoint pubblico (necessaria prima della subscribe push) */
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() })
})

// Routes pubbliche
app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/admin', adminRouter)

app.get('/api/analytics/summary', authenticate, requireDashboardAccess, async (req, res) => {
  try {
    const restaurantId = (req as AuthRequest).restaurantId
    if (!restaurantId) {
      res.status(401).json({ error: 'Non autenticato' })
      return
    }
    const summary = await buildDashboardSummary(restaurantId)
    res.json(summary)
  } catch {
    res.status(500).json({ error: 'Errore caricamento dashboard' })
  }
})

// Routes protette — sbarramento centralizzato su tier operativo
app.use('/api/restaurant', authenticate, restaurantRouter)
app.use('/api/push', authenticate, requireDashboardAccess, pushRouter)
app.use('/api/tables', authenticate, requireDashboardAccess, tablesRouter)
app.use('/api/menu', authenticate, requireDashboardAccess, menuRouter)
app.use('/api/orders', authenticate, requireDashboardAccess, ordersRouter)
app.use('/api/reservations', authenticate, requireDashboardAccess, reservationsRouter)
app.use('/api/customers', authenticate, requireDashboardAccess, requireProPlan, customersRouter)
app.use('/api/staff', authenticate, requireDashboardAccess, staffRouter)
app.use('/api/inventory', authenticate, requireDashboardAccess, inventoryRouter)
app.use('/api/analytics', authenticate, requireDashboardAccess, requireProPlan, analyticsRouter)
app.use('/api/loyalty', authenticate, requireDashboardAccess, requireProPlan, loyaltyRouter)
app.use('/api/marketing', authenticate, requireDashboardAccess, requireProPlan, marketingRouter)
app.use('/api/reports', authenticate, requireDashboardAccess, reportsRouter)
app.use('/api/waitlist', authenticate, requireDashboardAccess, waitlistRouter)
// Pagamenti: checkout e webhook sono pubblici, /overview è protetta
app.use('/api/payments', paymentsRouter)
app.use('/api/webhooks/stripe', stripeWebhookRouter)
app.use('/api/checkout', authenticate, checkoutRouter)
app.use('/api/ai', authenticate, requireDashboardAccess, requireProPlan, aiRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

setupSocketHandlers(io)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`)
  console.log(`📦 Database: ${process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL (Supabase)' : 'SQLite'}`)
  console.log(`🔌 WebSocket pronto`)

  const schedulerMs = Number(process.env.MARKETING_SCHEDULER_MS || 3600_000)
  setInterval(async () => {
    try {
      const campaigns = await processScheduledCampaigns()
      if (campaigns > 0) console.info('[scheduler] Campagne inviate:', campaigns)
    } catch (err) {
      console.error('[scheduler] Errore campagne:', err)
    }
  }, schedulerMs)
})
