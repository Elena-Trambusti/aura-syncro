import { useTranslation } from 'react-i18next'
import { Receipt, ShoppingBag, Sparkles, Users } from 'lucide-react'
import MobileBottomSheet from '../ui/MobileBottomSheet'
import { cn, formatCurrency, formatTime } from '../../lib/utils'
import { findActiveTableOrder } from '../../lib/orderSession'
import { isTableBillStage } from '../../lib/tableFilters'
import { TABLE_STATUS_BADGE, type FloorTable, type TableStatus } from './TableFloorPlan'

export interface TableDetailData extends FloorTable {
  orders?: Array<{ id: string; status: string; total: number; createdAt: string; items?: Array<{ status: string }> }>
  reservations?: Array<{ id: string; guestName: string; date: string; covers: number }>
}

interface TableDetailSheetProps {
  table: TableDetailData
  statusLabel: (status: TableStatus) => string
  onClose: () => void
  onOpenOrder: () => void
  onGoToPayment?: () => void
  onMarkFree: () => void
  onSeatReservation?: () => void
  canCreateOrder?: boolean
  canPayOrder?: boolean
  isPending?: boolean
}

export default function TableDetailSheet({
  table,
  statusLabel,
  onClose,
  onOpenOrder,
  onGoToPayment,
  onMarkFree,
  onSeatReservation,
  canCreateOrder = true,
  canPayOrder = false,
  isPending = false,
}: TableDetailSheetProps) {
  const { t } = useTranslation()
  const activeOrder = findActiveTableOrder(table.orders)
  const isBill = isTableBillStage(table)
  const reservation = table.reservations?.[0] ?? table.upcomingReservation
  const prefix = table.shape === 'BAR_STOOL' ? 'B' : table.shape === 'BOOTH' ? 'G' : 'T'

  const primaryAction = (() => {
    if (table.status === 'CLEANING') {
      return { label: t('tables.markFree'), icon: Sparkles, onClick: onMarkFree }
    }
    if (table.status === 'RESERVED' && reservation) {
      return { label: t('tables.seatAndOpenOrder'), icon: Users, onClick: onSeatReservation ?? onOpenOrder }
    }
    if (isBill && canPayOrder && onGoToPayment) {
      return { label: t('orderModal.goToPayment'), icon: Receipt, onClick: onGoToPayment }
    }
    if (table.status === 'OCCUPIED' || table.status === 'FREE') {
      if (!canCreateOrder && !activeOrder) return null
      return {
        label: activeOrder ? t('tables.mobile.openOrder') : t('tables.mobile.newOrder'),
        icon: ShoppingBag,
        onClick: onOpenOrder,
      }
    }
    return null
  })()

  const titleId = `table-detail-${table.id}`

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={`${prefix}${table.number}`}
      description={`${table.seats} ${t('common.seats')}${table.area ? ` · ${table.area}` : ''}`}
      titleId={titleId}
      footer={(
        <>
          {primaryAction && (
            <button
              type="button"
              disabled={isPending}
              onClick={primaryAction.onClick}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-aura-gold py-3.5 text-base font-semibold text-navy transition-colors hover:bg-aura-gold-light disabled:opacity-60"
            >
              <primaryAction.icon className="h-5 w-5 shrink-0" />
              {primaryAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl border border-white/10 bg-white/5 py-3.5 text-base font-medium text-pietra transition-colors hover:bg-white/10"
          >
            {t('common.close')}
          </button>
        </>
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', TABLE_STATUS_BADGE[table.status])}>
          {isBill ? t('tables.mobile.bill') : statusLabel(table.status)}
        </span>
        {activeOrder && (
          <span className="text-sm font-semibold tabular-nums text-[#F5E6A3]">
            {formatCurrency(activeOrder.total)}
          </span>
        )}
      </div>

      {reservation && table.status === 'RESERVED' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <p className="text-base font-semibold text-pietra">{reservation.guestName}</p>
          <p className="mt-1 text-sm text-fumo">
            {formatTime(reservation.date)} · {reservation.covers} {t('common.seats')}
          </p>
        </div>
      )}

      {activeOrder && (
        <p className="text-sm text-fumo">
          {t('tables.mobile.orderSince', { time: formatTime(activeOrder.createdAt) })}
        </p>
      )}
    </MobileBottomSheet>
  )
}
