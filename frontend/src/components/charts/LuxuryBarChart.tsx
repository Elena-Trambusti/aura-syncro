import type { ReactNode } from 'react'
import { useId } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '../../lib/utils'
import LuxuryGlassTooltip from './LuxuryGlassTooltip'
import { LuxuryBarGradientDef } from './LuxuryChartGradients'
import {
  ACCENT_STROKES,
  LUXURY_CHART,
  type LuxuryChartAccent,
} from './luxuryChartTheme'

export interface LuxuryBarChartProps<T extends object> {
  data: T[]
  dataKey: string
  xKey: string
  height?: number
  accent?: LuxuryChartAccent
  locale?: string
  xTickFormatter?: (value: string) => string
  labelFormatter?: (value: string) => string
  valueFormatter?: (value: number) => string
  valueLabel?: string
  barSize?: number
  className?: string
  emptyState?: ReactNode
}

export default function LuxuryBarChart<T extends object>({
  data,
  dataKey,
  xKey,
  height = 240,
  accent = 'gold',
  locale = 'it-IT',
  xTickFormatter,
  labelFormatter,
  valueFormatter = v => formatCurrency(v),
  valueLabel,
  barSize = 10,
  className,
  emptyState,
}: LuxuryBarChartProps<T>) {
  const gradientId = `luxury-bar-${accent}${useId().replace(/:/g, '')}`
  const stroke = ACCENT_STROKES[accent]

  if (!data.length) {
    return emptyState ? <>{emptyState}</> : null
  }

  const defaultXTick = (v: string) => {
    if (!v) return ''
    const d = new Date(v + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) return String(d.getDate())
    return String(v).slice(0, 4)
  }

  const defaultLabel = (v: string) => {
    const d = new Date(v + 'T12:00:00')
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
    }
    return String(v)
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barSize={barSize} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <LuxuryBarGradientDef id={gradientId} accent={accent} />
          </defs>
          <XAxis
            dataKey={xKey}
            tickFormatter={xTickFormatter ?? defaultXTick}
            tick={{ fontSize: 10, fill: LUXURY_CHART.axis }}
            axisLine={false}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tickFormatter={v => `€${v}`}
            tick={{ fontSize: 10, fill: LUXURY_CHART.axis }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: 'rgba(212, 175, 55, 0.06)', radius: 8 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const rawLabel = typeof label === 'string' ? label : String(label ?? '')
              const title = labelFormatter ? labelFormatter(rawLabel) : defaultLabel(rawLabel)
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
          <Bar
            dataKey={dataKey}
            fill={`url(#${gradientId})`}
            stroke={stroke}
            strokeWidth={0.5}
            strokeOpacity={0.35}
            radius={[6, 6, 0, 0]}
            isAnimationActive
            animationDuration={LUXURY_CHART.animationDuration}
            animationEasing={LUXURY_CHART.animationEasing}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
