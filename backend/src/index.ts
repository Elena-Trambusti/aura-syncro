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
import { authenticate } from './middleware/auth'
import { requireFullDashboardAccess } from './middleware/dashboardAccess'
import { requireProPlan } from './middleware/planTier'
import { errorHandler } from './middleware/errorHandler'
import { setupSocketHandlers } from './socket/handlers'
import { validateEnv } from './lib/env'

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

// Routes pubbliche
app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/admin', adminRouter)

// Routes protette — sbarramento centralizzato su tier operativo
app.use('/api/restaurant', authenticate, restaurantRouter)
app.use('/api/tables', authenticate, requireFullDashboardAccess, tablesRouter)
app.use('/api/menu', authenticate, requireFullDashboardAccess, menuRouter)
app.use('/api/orders', authenticate, requireFullDashboardAccess, ordersRouter)
app.use('/api/reservations', authenticate, requireFullDashboardAccess, reservationsRouter)
app.use('/api/customers', authenticate, requireFullDashboardAccess, requireProPlan, customersRouter)
app.use('/api/staff', authenticate, requireFullDashboardAccess, staffRouter)
app.use('/api/inventory', authenticate, requireFullDashboardAccess, inventoryRouter)
app.use('/api/analytics', authenticate, requireFullDashboardAccess, requireProPlan, analyticsRouter)
app.use('/api/loyalty', authenticate, requireFullDashboardAccess, requireProPlan, loyaltyRouter)
app.use('/api/marketing', authenticate, requireFullDashboardAccess, requireProPlan, marketingRouter)
app.use('/api/reports', authenticate, requireFullDashboardAccess, reportsRouter)
app.use('/api/waitlist', authenticate, requireFullDashboardAccess, waitlistRouter)
// Pagamenti: checkout e webhook sono pubblici, /overview è protetta
app.use('/api/payments', paymentsRouter)
app.use('/api/webhooks/stripe', stripeWebhookRouter)
app.use('/api/checkout', authenticate, checkoutRouter)
app.use('/api/ai', authenticate, requireFullDashboardAccess, requireProPlan, aiRouter)

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
})
