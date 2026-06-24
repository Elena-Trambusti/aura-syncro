import { z } from 'zod'
import { prisma } from './prisma'
import { stripe, STRIPE_ENABLED } from './stripe'
import { computeTaxForRestaurant } from './orderTax'
import { PublicOrderError } from './publicOrder'
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

  const restaurant = await prisma.restaurant.findUnique({ where: { slug } })
  if (!restaurant) {
    throw new PublicOrderError('Ristorante non trovato', 404)
  }

  const restaurantId = restaurant.id

  let tableId: string | undefined
  if (tableNumber) {
    const table = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId, number: tableNumber } },
    })
    if (table) tableId = table.id
  }

  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map(i => i.menuItemId) },
      restaurantId,
      available: true,
    },
  })

  if (menuItems.length !== items.length) {
    throw new PublicOrderError('Alcuni piatti non sono disponibili', 400)
  }

  const itemsWithPrice = items.map(item => {
    const mi = menuItems.find(m => m.id === item.menuItemId)!
    return { ...item, unitPrice: mi.price, name: mi.name }
  })

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

  if (tax > 0) {
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: 'IVA / Imposte' },
        unit_amount: Math.round(tax * 100),
      },
      quantity: 1,
    })
  }

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
