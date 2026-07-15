import { prisma } from './prisma'
import { buildFiscalConfig } from './taxEngine'
import { computeOnboardingReadiness } from './onboardingReadiness'
import { verifyFiscalChainSequence } from './fiscal/fiscalIntegrityChain'
import { moneyNumber } from './money'
import { dayBoundsInTimezone } from './romeDate'
import { calendarDateInTimezone } from './dates'

export type ComplianceCheck = {
  id: string
  ok: boolean
  severity: 'required' | 'recommended'
  detail?: string
}

export type ComplianceStatus = {
  score: number
  readyForFiscalClose: boolean
  checks: ComplianceCheck[]
  fiscalRegion: string
  taxRegion: string
}

/** Stato conformità fiscale/operativa per dashboard impostazioni. */
export async function computeComplianceStatus(restaurantId: string): Promise<ComplianceStatus> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const settings = restaurant?.settings
  const fiscal = buildFiscalConfig(settings)
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'
  const today = calendarDateInTimezone(timeZone)
  const { gte, lt } = dayBoundsInTimezone(today, timeZone)

  const [readiness, openCash, todayPaidCount, chainSample] = await Promise.all([
    computeOnboardingReadiness(restaurantId),
    prisma.cashRegisterSession.findFirst({
      where: { restaurantId, status: 'OPEN' },
      select: { id: true, openedAt: true },
    }),
    prisma.order.count({
      where: {
        restaurantId,
        status: 'PAID',
        refundedAt: null,
        paidAt: { gte, lt },
      },
    }),
    prisma.order.findMany({
      where: { restaurantId, status: 'PAID', fiscalIntegrityHash: { not: null } },
      orderBy: { paidAt: 'desc' },
      take: 25,
      select: {
        id: true,
        total: true,
        fiscalPrevHash: true,
        fiscalIntegrityHash: true,
        fiscalClosedAt: true,
        paidAt: true,
      },
    }),
  ])

  const chainAudit = verifyFiscalChainSequence(
    chainSample.map(o => ({
      id: o.id,
      fiscalClosedAt: o.fiscalClosedAt,
      total: moneyNumber(o.total),
      fiscalPrevHash: o.fiscalPrevHash,
      fiscalIntegrityHash: o.fiscalIntegrityHash,
      paidAt: o.paidAt,
    })),
  )

  const legalNameOk = Boolean(settings?.legalName?.trim())
  const taxIdOk = Boolean(settings?.taxId?.trim())
  const integrityOk = chainSample.length === 0 || chainAudit.valid

  const checks: ComplianceCheck[] = [
    { id: 'taxId', ok: taxIdOk, severity: 'required' },
    { id: 'legalName', ok: legalNameOk, severity: 'required' },
    { id: 'fiscalRate', ok: fiscal.taxRate > 0, severity: 'required' },
    { id: 'subscription', ok: readiness.subscriptionActive, severity: 'required' },
    { id: 'pos', ok: readiness.posReady, severity: 'required', detail: readiness.posMode },
    { id: 'cashSession', ok: Boolean(openCash), severity: 'recommended', detail: openCash ? 'OPEN' : 'CLOSED' },
    { id: 'todaySales', ok: todayPaidCount > 0, severity: 'recommended', detail: `${todayPaidCount} conti` },
    { id: 'integrityChain', ok: integrityOk, severity: 'required' },
    { id: 'menu', ok: readiness.menuConfigured, severity: 'recommended' },
  ]

  const required = checks.filter(c => c.severity === 'required')
  const requiredOk = required.filter(c => c.ok).length
  const score = required.length > 0 ? Math.round((requiredOk / required.length) * 100) : 0

  const readyForFiscalClose =
    taxIdOk
    && legalNameOk
    && fiscal.taxRate > 0
    && integrityOk
    && Boolean(openCash)

  return {
    score,
    readyForFiscalClose,
    checks,
    fiscalRegion: fiscal.fiscalRegion,
    taxRegion: fiscal.taxRegion,
  }
}
