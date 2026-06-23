import { useMemo } from 'react'
import { cn } from '../../lib/utils'

type HourlyPoint = { hour: string; revenue: number; orders: number }

interface ServiceHeatmapProps {
  data: HourlyPoint[]
  locale: string
  peakLabel: string
  quietLabel: string
}

export default function ServiceHeatmap({ data, locale, peakLabel, quietLabel }: ServiceHeatmapProps) {
  const { maxOrders, peakHour } = useMemo(() => {
    let max = 0
    let peak = ''
    for (const row of data) {
      if (row.orders > max) {
        max = row.orders
        peak = row.hour
      }
    }
    return { maxOrders: max || 1, peakHour: peak }
  }, [data])

  const serviceHours = data.filter(row => {
    const hour = parseInt(row.hour, 10)
    return hour >= 11 && hour <= 23
  })

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fumo/80">{peakLabel}</p>
          <p className="mt-0.5 font-display text-lg font-semibold text-pietra tabular-nums">
            {peakHour || '—'}
          </p>
        </div>
        <p className="text-[11px] text-fumo/70">{quietLabel}</p>
      </div>

      <div className="grid aura-heatmap-grid gap-1.5">
        {serviceHours.map(row => {
          const intensity = row.orders / maxOrders
          const hourNum = parseInt(row.hour, 10)
          const label = new Date(2000, 0, 1, hourNum).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div key={row.hour} className="group flex flex-col items-center gap-1">
              <div
                className={cn(
                  'aura-heatmap-cell w-full rounded-md transition-transform duration-300 group-hover:scale-105',
                  intensity > 0.75 && 'aura-heatmap-cell--peak',
                  intensity > 0.4 && intensity <= 0.75 && 'aura-heatmap-cell--high',
                  intensity > 0.15 && intensity <= 0.4 && 'aura-heatmap-cell--mid',
                  intensity <= 0.15 && 'aura-heatmap-cell--low',
                )}
                title={`${label} · ${row.orders}`}
              />
              <span className="text-[9px] tabular-nums text-fumo/50 sm:text-[10px]">
                {row.hour.slice(0, 2)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
