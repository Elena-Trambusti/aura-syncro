import type { ReactNode } from 'react'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '../../lib/utils'
import { BRAND } from '../../lib/brand'
import LuxuryGlassTooltip from './LuxuryGlassTooltip'
import { LuxuryAreaGradientDef } from './LuxuryChartGradients'
import {
  ACCENT_STROKES,
  LUXURY_CHART,
  type LuxuryChartAccent,
} from './luxuryChartTheme'

export interface LuxuryAreaChartProps<T extends object> {
  data: T[]
  dataKey: string
  xKey: string
  height?: number
  accent?: LuxuryChartAccent
  locale?: string
  /** Formato asse X */
  xTickFormatter?: (value: string) => string
  /** Etichetta tooltip sull'asse X */
  labelFormatter?: (value: string, payload?: T) => string
  valueFormatter?: (value: number) => string
  valueLabel?: string
  showYAxis?: boolean
  className?: string
  emptyState?: ReactNode
}

export default function LuxuryAreaChart<T extends object>({
  data,
  dataKey,
  xKey,
  height = 280,
  accent = 'gold',
  locale = 'it-IT',
  xTickFormatter,
  labelFormatter,
  valueFormatter = v => formatCurrency(v),
  valueLabel,
  showYAxis = true,
  className,
  emptyState,
}: LuxuryAreaChartProps<T>) {
  const gradientId = `luxury-area-${accent}${useId().replace(/:/g, '')}`
  const stroke = ACCENT_STROKES[accent]

  if (!data.length) {
    return emptyState ? <>{emptyState}</> : null
  }

  const defaultXTick = (v: string) => {
    if (!v) return ''
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
    }
    return String(v).slice(0, 6)
  }

  const defaultLabel = (v: string) => {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale, {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    }
    return String(v)
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <LuxuryAreaGradientDef id={gradientId} accent={accent} fadeToBlack />
          </defs>
          <XAxis
            dataKey={xKey}
            tickFormatter={xTickFormatter ?? defaultXTick}
            tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          {showYAxis && (
            <YAxis
              tickFormatter={v => `€${v}`}
              tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
          )}
          <Tooltip
            cursor={{
              stroke: stroke,
              strokeWidth: 1,
              strokeDasharray: '4 6',
              strokeOpacity: 0.5,
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as T | undefined
              const rawLabel = typeof label === 'string' ? label : String(label ?? '')
              const title = labelFormatter
                ? labelFormatter(rawLabel, row)
                : defaultLabel(rawLabel)
              const value = Number(payload[0]?.value) || 0
              return (
                <LuxuryGlassTooltip
                  title={title}
                  rows={[
                    {
                      label: valueLabel ?? dataKey,
                      value: valueFormatter(value),
                      tone: 'gold',
                    },
                  ]}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={LUXURY_CHART.animationDuration}
            animationEasing={LUXURY_CHART.animationEasing}
            activeDot={{
              r: 6,
              fill: stroke,
              stroke: BRAND.champagne,
              strokeWidth: 2,
              className: 'luxury-chart-active-dot',
            }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
