import { prisma } from './prisma'
import { ensureDefaultLoyaltyTiers, ensureLoyaltyEnrollment } from './loyaltyHelpers'

export interface CustomerContactInput {
  name?: string | null
  email?: string | null
  phone?: string | null
}

/**
 * Trova o crea un cliente CRM e lo iscrive automaticamente al programma fedeltà.
 */
export async function resolveOrCreateCustomer(
  restaurantId: string,
  input: CustomerContactInput,
): Promise<string | undefined> {
  const email = input.email?.trim().toLowerCase() || undefined
  const phone = input.phone?.trim() || undefined
  const name = input.name?.trim() || (email ? email.split('@')[0]! : phone ? `Cliente ${phone.slice(-4)}` : undefined)

  if (!email && !phone) return undefined

  let customerId: string | undefined

  if (email) {
    const customer = await prisma.customer.upsert({
      where: { restaurantId_email: { restaurantId, email } },
      update: {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      },
      create: {
        restaurantId,
        name: name ?? email,
        email,
        phone,
      },
    })
    customerId = customer.id
  } else if (phone) {
    const existing = await prisma.customer.findFirst({
      where: { restaurantId, phone },
    })
    if (existing) {
      customerId = existing.id
      if (name && existing.name !== name) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: { name },
        })
      }
    } else {
      const created = await prisma.customer.create({
        data: {
          restaurantId,
          name: name ?? `Cliente ${phone.slice(-4)}`,
          phone,
        },
      })
      customerId = created.id
    }
  }

  if (customerId) {
    await ensureDefaultLoyaltyTiers(restaurantId)
    await ensureLoyaltyEnrollment(restaurantId, customerId)
  }

  return customerId
}

/** Verifica che il cliente appartenga al tenant prima di collegarlo a un ordine. */
export async function assertCustomerInTenant(
  customerId: string,
  restaurantId: string,
): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { id: true },
  })
  if (!customer) {
    throw Object.assign(new Error('CUSTOMER_NOT_FOUND'), { code: 'CUSTOMER_NOT_FOUND' })
  }
}

/** Collega cliente a ordine se email/nome disponibili (es. webhook Stripe guest) */
export async function linkCustomerToOrder(
  orderId: string,
  restaurantId: string,
  contact: CustomerContactInput,
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { customerId: true },
  })
  if (!order || order.customerId) return

  const customerId = await resolveOrCreateCustomer(restaurantId, contact)
  if (!customerId) return

  await prisma.order.update({
    where: { id: orderId },
    data: { customerId },
  })
}
