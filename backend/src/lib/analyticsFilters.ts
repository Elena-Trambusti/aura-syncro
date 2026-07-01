import { paidOrdersInPeriodWhere } from './dates'

/** KPI dashboard/analytics — periodo con fine esclusiva (allineato a dayBounds tenant). */
export function paidRevenueOrderWhere(restaurantId: string, start: Date, end: Date) {
  return paidOrdersInPeriodWhere(restaurantId, start, end, true)
}
