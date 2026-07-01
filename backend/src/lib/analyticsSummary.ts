import { prisma } from './prisma'
import {
  buildMonthRangeInTimezone,
  calendarDateInTimezone,
  dayBoundsInTimezone,
  shiftCalendarDate,
} from './dates'
import { buildFiscalConfig } from './taxEngine'
import { kitchenActiveOrdersWhere } from './orderSession'
import { sumFoodFromMoneyAgg, moneyNumber } from './money'
import { paidRevenueOrderWhere } from './analyticsFilters'

export async function loadTenantTimeRanges(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const timeZone = restaurant?.timezone ?? fiscal.timezone
  const todayStr = calendarDateInTimezone(timeZone)
  const { gte: todayStart, lt: todayEnd } = dayBoundsInTimezone(todayStr, timeZone)

  const year = Number(todayStr.slice(0, 4))
  const month = Number(todayStr.slice(5, 7))
  const { start: monthStart } = buildMonthRangeInTimezone(year, month, timeZone)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: lastMonthStart } = buildMonthRangeInTimezone(prevYear, prevMonth, timeZone)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const { gte: monthEndExclusive } = dayBoundsInTimezone(nextMonthStart, timeZone)
  const prevMonthEndStart = `${year}-${String(month).padStart(2, '0')}-01`
  const { gte: lastMonthEndExclusive } = dayBoundsInTimezone(prevMonthEndStart, timeZone)

  const dayOfMonth = Number(todayStr.slice(8, 10))
  const prevMonthDays = new Date(prevYear, prevMonth, 0).getDate()
  const clampedDay = Math.min(dayOfMonth, prevMonthDays)
  const lastMonthPartialDayStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
  const { lt: lastMonthPartialEnd } = dayBoundsInTimezone(
    shiftCalendarDate(lastMonthPartialDayStr, 1),
    timeZone,
  )

  return {
    timeZone,
    todayStart,
    todayEnd,
    monthStart,
    monthEndExclusive,
    lastMonthStart,
    lastMonthEndExclusive,
    lastMonthPartialEnd,
  }
}

/** KPI dashboard — disponibile anche piano Base (senza Pro). */
export async function buildDashboardSummary(restaurantId: string) {
  const ranges = await loadTenantTimeRanges(restaurantId)

  const [
    todayOrders,
    todayRevenue,
    monthRevenue,
    lastMonthPartialRevenue,
    totalCustomers,
    todayReservations,
    activeOrders,
    lowStockItems,
    turnoverOrders,
  ] = await Promise.all([
    prisma.order.count({
      where: {
        restaurantId,
        createdAt: { gte: ranges.todayStart, lt: ranges.todayEnd },
        status: { notIn: ['CANCELLED'] },
      },
    }),
    prisma.order.aggregate({
      where: paidRevenueOrderWhere(restaurantId, ranges.todayStart, ranges.todayEnd),
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.order.aggregate({
      where: paidRevenueOrderWhere(restaurantId, ranges.monthStart, ranges.monthEndExclusive),
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.order.aggregate({
      where: paidRevenueOrderWhere(restaurantId, ranges.lastMonthStart, ranges.lastMonthPartialEnd),
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.customer.count({ where: { restaurantId } }),
    prisma.reservation.count({
      where: {
        restaurantId,
        date: { gte: ranges.todayStart, lt: ranges.todayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    }),
    prisma.order.count({ where: kitchenActiveOrdersWhere(restaurantId) }),
    prisma.inventoryItem.count({
      where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
    }),
    prisma.order.findMany({
      where: {
        ...paidRevenueOrderWhere(restaurantId, ranges.todayStart, ranges.todayEnd),
        tableId: { not: null },
      },
      select: { createdAt: true, paidAt: true },
    }),
  ])

  const monthFood = sumFoodFromMoneyAgg(monthRevenue)
  const lastMonthFood = sumFoodFromMoneyAgg(lastMonthPartialRevenue)
  const revenueGrowth = lastMonthFood ? ((monthFood - lastMonthFood) / lastMonthFood) * 100 : 0

  let totalMinutes = 0
  let turnoverCount = 0
  for (const o of turnoverOrders) {
    const paid = o.paidAt ?? o.createdAt
    const mins = (paid.getTime() - o.createdAt.getTime()) / 60_000
    if (mins > 0 && mins < 480) {
      totalMinutes += mins
      turnoverCount++
    }
  }
  const avgTurnoverMinutes = turnoverCount > 0 ? Math.round(totalMinutes / turnoverCount) : 0

  return {
    today: {
      orders: todayOrders,
      revenue: sumFoodFromMoneyAgg(todayRevenue),
      tips: moneyNumber(todayRevenue._sum.tipAmount),
      collected: moneyNumber(todayRevenue._sum.total),
      reservations: todayReservations,
      activeOrders,
    },
    month: {
      revenue: monthFood,
      tips: moneyNumber(monthRevenue._sum.tipAmount),
      collected: moneyNumber(monthRevenue._sum.total),
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    },
    totals: { customers: totalCustomers, lowStockAlerts: lowStockItems, avgTurnoverMinutes },
  }
}
