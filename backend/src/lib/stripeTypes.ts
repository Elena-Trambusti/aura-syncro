/** Tipi Stripe minimali — compatibili con stripe-node v22+ */

export type StripeAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export type StripeCustomerPayload = {
  id: string
  deleted?: boolean
  name?: string | null
  email?: string | null
  metadata?: Record<string, string>
  address?: StripeAddress | null
  tax_ids?: {
    data?: Array<{ value: string }>
  }
}

export type StripeInvoicePayload = {
  id: string
  number?: string | null
  customer?: string | { id: string } | null
  subscription?: string | { id: string } | null
  amount_paid?: number | null
  total?: number | null
  subtotal?: number | null
  subtotal_excluding_tax?: number | null
  tax?: number | null
  currency?: string | null
  metadata?: Record<string, string>
  customer_address?: StripeAddress | null
  status_transitions?: {
    paid_at?: number | null
  } | null
}

export type StripeEventPayload = {
  id: string
  type: string
  livemode: boolean
  data: {
    object: Record<string, unknown>
  }
}

export type StripeCheckoutSessionPayload = {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
  customer?: string | { id: string } | null
  mode?: string | null
}

export type StripeSubscriptionPayload = {
  id: string
  status: string
  metadata?: Record<string, string> | null
}

export type StripePaymentIntentPayload = {
  id: string
  status: string
  amount: number
  amount_received?: number | null
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
}
