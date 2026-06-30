import type { ReactNode } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { formatCurrency } from '../../lib/utils'
import { BRAND } from '../../lib/brand'
import LuxuryGlassTooltip from './LuxuryGlassTooltip'
import {
  ACCENT_STROKES,
  LUXURY_CHART,
  type LuxuryChartAccent,
} from './luxuryChartTheme'

export interface LuxuryLineSeries {
  dataKey: string
  label: string
  accent?: LuxuryChartAccent
  dashed?: boolean
  dot?: boolean
}

export interface LuxuryLineChartProps<T extends object> {
  data: T[]
  series: LuxuryLineSeries[]
  xKey: string
  height?: number
  locale?: string
  xTickFormatter?: (value: string) => string
  labelFormatter?: (value: string, payload?: T) => string
  valueFormatter?: (value: number, seriesKey: string) => string
  showYAxis?: boolean
  showLegend?: boolean
  yAxisInteger?: boolean
  className?: string
  emptyState?: ReactNode
}

export default function LuxuryLineChart<T extends object>({
  data,
  series,
  xKey,
  height = 280,
  xTickFormatter,
  labelFormatter,
  valueFormatter,
  showYAxis = true,
  showLegend = false,
  yAxisInteger = false,
  className,
  emptyState,
}: LuxuryLineChartProps<T>) {
  if (!data.length) {
    return emptyState ? <>{emptyState}</> : null
  }

  const defaultFormatter = (v: number, key: string) => {
    if (valueFormatter) return valueFormatter(v, key)
    if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount')) {
      return formatCurrency(v)
    }
    return String(v)
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey={xKey}
            tickFormatter={xTickFormatter}
            tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          {showYAxis && (
            <YAxis
              tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
              axisLine={false}
              tickLine={false}
              allowDecimals={!yAxisInteger}
              width={40}
            />
          )}
          <Tooltip
            cursor={{
              stroke: BRAND.gold,
              strokeWidth: 1,
              strokeDasharray: '4 6',
              strokeOpacity: 0.4,
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as T | undefined
              const rawLabel = typeof label === 'string' ? label : String(label ?? '')
              const title = labelFormatter
                ? labelFormatter(rawLabel, row)
                : rawLabel
              return (
                <LuxuryGlassTooltip
                  title={title}
                  rows={payload.map(entry => {
                    const key = String(entry.dataKey ?? entry.name ?? '')
                    const meta = series.find(s => s.dataKey === key)
                    return {
                      label: meta?.label ?? key,
                      value: defaultFormatter(Number(entry.value) || 0, key),
                      tone: meta?.accent === 'emerald' ? 'emerald' as const : 'gold' as const,
                    }
                  })}
                />
              )
            }}
          />
          {showLegend && (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="line"
              wrapperStyle={{ paddingBottom: 12 }}
              formatter={value => {
                const meta = series.find(s => s.dataKey === value)
                return (
                  <span className="text-xs text-fumo">{meta?.label ?? value}</span>
                )
              }}
            />
          )}
          {series.map(s => {
            const stroke = ACCENT_STROKES[s.accent ?? 'gold']
            return (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.dataKey}
                stroke={stroke}
                strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? '6 5' : undefined}
                dot={s.dot === false ? false : { r: 4, fill: stroke, strokeWidth: 0 }}
                activeDot={{
                  r: 6,
                  fill: stroke,
                  stroke: BRAND.champagne,
                  strokeWidth: 2,
                  className: 'luxury-chart-active-dot',
                }}
                isAnimationActive
                animationDuration={LUXURY_CHART.animationDuration}
                animationEasing={LUXURY_CHART.animationEasing}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
