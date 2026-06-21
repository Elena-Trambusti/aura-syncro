import { useTranslation } from 'react-i18next'
import { ShoppingBag } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

interface GuestCartBarProps {
  itemCount: number
  total: number
  onOpen: () => void
}

export default function GuestCartBar({ itemCount, total, onOpen }: GuestCartBarProps) {
  const { t } = useTranslation()

  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-amber-500 px-4 py-3.5 text-left text-white shadow-sm transition-colors hover:bg-amber-600"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-bold">
              {itemCount}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('publicMenu.viewCart')}</span>
            <span className="block text-xs text-white/80">
              {t('publicMenu.cartItems', { count: itemCount })}
            </span>
          </span>
          <span className="shrink-0 text-lg font-black tabular-nums">{formatCurrency(total)}</span>
        </button>
      </div>
    </div>
  )
}
