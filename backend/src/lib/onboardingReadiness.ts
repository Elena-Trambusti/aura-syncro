import { prisma } from './prisma'
import { loadRestaurantPosConfig } from './posIntegration'
import { buildFiscalConfig } from './taxEngine'

export type OnboardingReadiness = {
  menuConfigured: boolean
  menuItemCount: number
  tablesConfigured: boolean
  tableCount: number
  fiscalConfigured: boolean
  taxIdPresent: boolean
  posReady: boolean
  posMode: string
  subscriptionActive: boolean
  staffCount: number
  cashSessionOpen: boolean
  readyForService: boolean
  checks: Array<{ id: string; ok: boolean; detail?: string }>
}

/** Verifica automatica prerequisiti go-live (checklist sistema, non checkbox utente). */
export async function computeOnboardingReadiness(restaurantId: string): Promise<OnboardingReadiness> {
  const [restaurant, menuItemCount, tableCount, staffCount, openCash] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { settings: true },
    }),
    prisma.menuItem.count({
      where: { restaurantId, archived: false, available: true },
    }),
    prisma.table.count({ where: { restaurantId } }),
    prisma.user.count({ where: { restaurantId } }),
    prisma.cashRegisterSession.findFirst({
      where: { restaurantId, status: 'OPEN' },
      select: { id: true },
    }),
  ])

  const settings = restaurant?.settings
  const fiscal = buildFiscalConfig(settings)
  const taxIdPresent = Boolean(settings?.taxId?.trim())
  const fiscalConfigured = taxIdPresent && fiscal.taxRate > 0
  const menuConfigured = menuItemCount >= 3
  const tablesConfigured = tableCount >= 1
  const posConfig = await loadRestaurantPosConfig(restaurantId)
  const posReady =
    posConfig.mode !== 'PENDING_SETUP'
    || process.env.POS_ALLOW_SIMULATION === 'true'
  const subscriptionActive = restaurant?.settings?.hasActiveSubscription === true

  const checks = [
    { id: 'subscription', ok: subscriptionActive },
    { id: 'menu', ok: menuConfigured, detail: `${menuItemCount} piatti` },
    { id: 'tables', ok: tablesConfigured, detail: `${tableCount} tavoli` },
    { id: 'fiscal', ok: fiscalConfigured },
    { id: 'pos', ok: posReady, detail: posConfig.mode },
    { id: 'staff', ok: staffCount >= 1, detail: `${staffCount} utenti` },
  ]

  const readyForService =
    subscriptionActive
    && menuConfigured
    && tablesConfigured
    && fiscalConfigured
    && posReady

  return {
    menuConfigured,
    menuItemCount,
    tablesConfigured,
    tableCount,
    fiscalConfigured,
    taxIdPresent,
    posReady,
    posMode: posConfig.mode,
    subscriptionActive,
    staffCount,
    cashSessionOpen: Boolean(openCash),
    readyForService,
    checks,
  }
}
