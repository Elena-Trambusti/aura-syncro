import { z } from 'zod'
import { prisma } from './prisma'
import { stripe, STRIPE_ENABLED, STRIPE_APPLICATION_FEE_PCT } from './stripe'
import { computeTaxFromGrossLines } from './orderTax'
import { PublicOrderError, resolveGuestItemsWithStock } from './publicOrder'
import { assertOrderStockInTransaction } from './menuStock'
import { verifyTableToken } from './tableToken'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'
import { resolvePrimaryFrontendUrl } from './frontendUrl'
import { resolveOrCreateCustomer } from './customerResolver'
import { signOrderReceiptToken } from './paymentReceiptToken'
import { deductInventoryForOrder } from './inventoryDeduction'
import { occupyTableForSessionOrder } from './orderSession'
import { runOrderTransaction } from './prismaTransactions'
import {
  acquireIdempotencyLock,
  getIdempotentResponse,
  releaseIdempotencyLock,
  saveIdempotentResponse,
} from './apiIdempotency'

export const guestCheckoutSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.number().int().positive().optional(),
  tableToken: z.string().min(8).optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive().max(99),
    modifiers: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })).min(1).max(50),
  clientRequestId: z.string().min(8).max(128).optional(),
  tipAmount: z.number().min(0).max(500).optional(),
})

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>

export interface GuestCheckoutResult {
  checkoutUrl: string
  sessionId: string
  orderId: string
  order: {
    id: string
    restaurantId: string
    status: string
    table?: { id: string; number: number; status: string } | null
    items: Array<{
      id: string
      quantity: number
      status: string
      menuItem: { name: string }
    }>
  }
}

/** Crea ordine PENDING + sessione Stripe Checkout per guest dal menu QR */
export async function createGuestStripeCheckout(
  input: GuestCheckoutInput,
): Promise<GuestCheckoutResult> {
  const frontendUrl = resolvePrimaryFrontendUrl()
  if (!STRIPE_ENABLED) {
    throw new PublicOrderError('Pagamenti online non configurati', 503)
  }

  const { items, tableNumber, tableToken, slug, customerName, customerEmail, clientRequestId, tipAmount = 0, ...orderData } = input

  const restaurant = await prisma.restaurant.findUnique({ 
    where: { slug },
    include: { settings: true }
  })
  if (!restaurant || !restaurant.settings) {
    throw new PublicOrderError('Ristorante non trovato', 404)
  }

  const restaurantId = restaurant.id

  if (orderData.type === 'DINE_IN') {
    if (!tableNumber) {
      throw new PublicOrderError('Numero tavolo obbligatorio per ordini in sala', 400, 'TABLE_NUMBER_REQUIRED')
    }
    if (!verifyTableToken(restaurantId, tableNumber, tableToken)) {
      throw new PublicOrderError('Token tavolo non valido', 403, 'TABLE_TOKEN_INVALID')
    }
  } else if (tableNumber != null) {
    // TAKEAWAY non può occupare un tavolo senza token QR (anti-abuse)
    if (!verifyTableToken(restaurantId, tableNumber, tableToken)) {
      throw new PublicOrderError('Token tavolo non valido', 403, 'TABLE_TOKEN_INVALID')
    }
  }

  const connectAccountId = restaurant.settings.stripeConnectAccountId
  if (!connectAccountId) {
    throw new PublicOrderError(
      'Pagamenti online non configurati: collega Stripe Connect',
      503,
      'STRIPE_CONNECT_REQUIRED',
    )
  }
  const idemKey = clientRequestId ? `guest-checkout:${clientRequestId}` : null
  let idempotencyLocked = false

  try {
  if (idemKey) {
    const cached = await getIdempotentResponse(restaurantId, idemKey, 'PUBLIC_GUEST_CHECKOUT')
    if (cached && cached.statusCode === 201) {
      return cached.responseBody as GuestCheckoutResult
    }
    const lock = await acquireIdempotencyLock(restaurantId, idemKey, 'PUBLIC_GUEST_CHECKOUT')
    if (!lock) {
      throw new PublicOrderError('Checkout già in elaborazione', 409, 'CHECKOUT_IN_PROGRESS')
    }
    idempotencyLocked = true
  }

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (!table) {
      throw new PublicOrderError('Tavolo non trovato', 404, 'TABLE_NOT_FOUND')
    }
    tableId = table.id
  }

  const itemsWithPriceRaw = await resolveGuestItemsWithStock(restaurantId, items)
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map(i => i.menuItemId) }, restaurantId },
    select: { id: true, name: true },
  })
  const itemsWithPrice = itemsWithPriceRaw.map(item => ({
    ...item,
    name: menuItems.find(m => m.id === item.menuItemId)?.name ?? 'Piatto',
  }))

  const grossTotal = itemsWithPrice.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const { subtotal, tax, total, taxRateApplied } = await computeTaxFromGrossLines(
    restaurantId,
    itemsWithPriceRaw.map(item => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.menuTaxRate,
    })),
  )

  const safeTip = Math.round(Math.max(0, tipAmount) * 100) / 100
  const orderTotal = total + safeTip

  const customerId = await resolveOrCreateCustomer(restaurantId, {
    email: customerEmail,
    name: customerName,
  })

  if (tableId) {
    const staleCutoff = new Date(Date.now() - 15 * 60_000)
    const staleCheckouts = await prisma.order.findMany({
      where: {
        restaurantId,
        tableId,
        status: 'PENDING',
        stripeSessionId: { not: null },
        createdAt: { lt: staleCutoff },
      },
      select: { id: true },
    })
    for (const stale of staleCheckouts) {
      await cancelAbandonedGuestOrder(stale.id)
    }
  }

  const order = await runOrderTransaction(async tx => {
    await assertOrderStockInTransaction(
      tx,
      restaurantId,
      itemsWithPriceRaw.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
    )

    const created = await tx.order.create({
      data: {
        restaurantId,
        tableId,
        customerId,
        subtotal,
        tax,
        total: orderTotal,
        taxRateApplied,
        revenueAmount: total,
        tipAmount: safeTip,
        type: orderData.type,
        notes: orderData.notes,
        status: 'PENDING',
        items: {
          create: itemsWithPriceRaw.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            modifiers: item.selectedOptions?.length
              ? { create: item.selectedOptions.map(o => ({ optionId: o.optionId, name: o.name, price: o.price })) }
              : undefined,
          })),
        },
      },
      include: {
        table: true,
        items: { include: { menuItem: true } },
      },
    })
    // RC-01: Inventory deducted immediately (pay-at-table path).
    // For Stripe guest checkout the inventory is deducted here too,
    // so if Stripe session creation fails below we must cancel the order.
    await deductInventoryForOrder(tx, created.id, restaurantId)
    if (tableId) {
      const occupied = await occupyTableForSessionOrder(tx, tableId, restaurantId, created.id)
      if (!occupied) {
        throw new PublicOrderError('Tavolo non disponibile', 409, 'TABLE_UNAVAILABLE')
      }
    }
    return created
  })

  const lineItems = itemsWithPrice.map(item => ({
    price_data: {
      currency: 'eur' as const,
      product_data: {
        name: item.name,
        ...(item.notes ? { description: item.notes } : {}),
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity,
  }))

  if (safeTip > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur' as const,
        product_data: { name: 'Mancia' },
        unit_amount: Math.round(safeTip * 100),
      },
      quantity: 1,
    })
  }

  const receiptToken = signOrderReceiptToken(order.id)

  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customerEmail,
      metadata: {
        orderId: order.id,
        restaurantId,
        tableNumber: tableNumber?.toString() || '',
        customerName: customerName || '',
        customerEmail: customerEmail || '',
      },
      line_items: lineItems,
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}&receipt_token=${encodeURIComponent(receiptToken)}`,
      cancel_url: `${frontendUrl}/menu/${slug}?payment=cancelled`,
      ...(connectAccountId ? {
        payment_intent_data: {
          application_fee_amount: Math.round(orderTotal * STRIPE_APPLICATION_FEE_PCT * 100),
          transfer_data: {
            destination: connectAccountId,
          },
          metadata: {
            orderId: order.id,
            restaurantId,
          },
        }
      } : {})
    })
  } catch {
    // Stripe failure after inventory deduction: cancel order to restore stock/table.
    await cancelAbandonedGuestOrder(order.id)
    throw new PublicOrderError('Impossibile creare la sessione di pagamento', 502)
  }

  if (!session.url) {
    await cancelAbandonedGuestOrder(order.id)
    throw new PublicOrderError('Impossibile creare la sessione di pagamento', 500)
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  const result: GuestCheckoutResult = {
    checkoutUrl: session.url,
    sessionId: session.id,
    orderId: order.id,
    order,
  }

  if (idemKey) {
    await saveIdempotentResponse(restaurantId, idemKey, 'PUBLIC_GUEST_CHECKOUT', 201, result)
    idempotencyLocked = false
  }

    return result
  } catch (err) {
    if (idemKey && idempotencyLocked) {
      await releaseIdempotencyLock(restaurantId, idemKey)
    }
    throw err
  }
}
