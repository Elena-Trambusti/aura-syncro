import { PrismaClient } from '@prisma/client'

const IMMUTABLE_FISCAL_FIELDS = new Set([
  'subtotal',
  'tax',
  'taxRateApplied',
  'revenueAmount',
  'tipAmount',
  'total',
  'fiscalRegionSnapshot',
  'fiscalIntegrityHash',
  'fiscalPrevHash',
  'fiscalClosedAt',
  'paidAt',
  'paymentMethod',
])

function touchesImmutableFiscalFields(data: Record<string, unknown>): boolean {
  return Object.keys(data).some(k => IMMUTABLE_FISCAL_FIELDS.has(k))
}

export function withOrderIntegrityGuard(client: PrismaClient) {
  return client.$extends({
    query: {
      order: {
        async update({ args, query }) {
          const where = args.where as { id?: string }
          if (where.id) {
            const order = await client.order.findUnique({
              where: { id: where.id },
              select: { status: true, fiscalIntegrityHash: true },
            })
            if (order?.status === 'PAID' && order.fiscalIntegrityHash) {
              if (touchesImmutableFiscalFields(args.data as Record<string, unknown>)) {
                throw new Error('FISCAL_RECORD_IMMUTABLE')
              }
            }
          }
          return query(args)
        },
        async delete({ args, query }) {
          const where = args.where as { id?: string }
          if (where.id) {
            const order = await client.order.findUnique({
              where: { id: where.id },
              select: { status: true, fiscalIntegrityHash: true },
            })
            if (order?.status === 'PAID' && order.fiscalIntegrityHash) {
              throw new Error('FISCAL_RECORD_DELETE_FORBIDDEN')
            }
          }
          return query(args)
        },
      },
    },
  })
}
