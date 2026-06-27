import { z } from 'zod'
import { prisma } from './prisma'
import { stripe, STRIPE_ENABLED, STRIPE_APPLICATION_FEE_PCT } from './stripe'
import { computeTaxForRestaurant } from './orderTax'
import { PublicOrderError, resolveGuestItemsWithStock } from './publicOrder'
import { resolvePrimaryFrontendUrl } from './frontendUrl'
import { resolveOrCreateCustomer } from './customerResolver'

export const guestCheckoutSchema = z.object({
  slug: z.string().min(1),
  type: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
})

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>

export interface GuestCheckoutResult {
  checkoutUrl: string
  sessionId: string
  orderId: string
}

/** Crea ordine PENDING + sessione Stripe Checkout per guest dal menu QR */
export async function createGuestStripeCheckout(
  input: GuestCheckoutInput,
): Promise<GuestCheckoutResult> {
  const frontendUrl = resolvePrimaryFrontendUrl()
  if (!STRIPE_ENABLED) {
    throw new PublicOrderError('Pagamenti online non configurati', 503)
  }

  const { items, tableNumber, slug, customerName, customerEmail, ...orderData } = input

  const restaurant = await prisma.restaurant.findUnique({ 
    where: { slug },
    include: { settings: true }
  })
  if (!restaurant || !restaurant.settings) {
    throw new PublicOrderError('Ristorante non trovato', 404)
  }

  const restaurantId = restaurant.id
  const connectAccountId = restaurant.settings.stripeConnectAccountId

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
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
  const { subtotal, tax, total, taxRateApplied } = await computeTaxForRestaurant(restaurantId, grossTotal)

  const customerId = await resolveOrCreateCustomer(restaurantId, {
    email: customerEmail,
    name: customerName,
  })

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        restaurantId,
        tableId,
        customerId,
        subtotal,
        tax,
        total,
        taxRateApplied,
        revenueAmount: total,
        tipAmount: 0,
        type: orderData.type,
        notes: orderData.notes,
        status: 'PENDING',
        items: {
          create: itemsWithPrice.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
          })),
        },
      },
    })
    return created
  })

  if (tableId) {
    await prisma.table.update({ where: { id: tableId }, data: { status: 'OCCUPIED' } })
  }

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

  const session = await stripe.checkout.sessions.create({
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
    success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
    cancel_url: `${frontendUrl}/menu/${slug}?payment=cancelled`,
    ...(connectAccountId ? {
      payment_intent_data: {
        application_fee_amount: Math.round(total * STRIPE_APPLICATION_FEE_PCT * 100),
        transfer_data: {
          destination: connectAccountId,
        },
      }
    } : {})
  })

  if (!session.url) {
    throw new PublicOrderError('Impossibile creare la sessione di pagamento', 500)
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id },
  })

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    orderId: order.id,
  }
}
