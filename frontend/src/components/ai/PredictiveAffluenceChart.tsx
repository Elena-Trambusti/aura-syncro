import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BRAND } from '../../lib/brand'
import LuxuryGlassTooltip from '../charts/LuxuryGlassTooltip'
import { LuxuryAreaGradientDef } from '../charts/LuxuryChartGradients'
import { ACCENT_STROKES, LUXURY_CHART } from '../charts/luxuryChartTheme'
import type { ChartDayRow } from './types'

interface PredictiveAffluenceChartProps {
  data: ChartDayRow[]
  height?: number
  hasReservationData: boolean
}

export default function PredictiveAffluenceChart({
  data,
  height = 320,
  hasReservationData,
}: PredictiveAffluenceChartProps) {
  const { t } = useTranslation()
  const gradientId = `predictive-area-gold${useId().replace(/:/g, '')}`

  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <LuxuryAreaGradientDef id={gradientId} accent="gold" fadeToBlack />
        </defs>
        <XAxis
          dataKey="dayLabel"
          tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
          axisLine={false}
          tickLine={false}
          dy={8}
        />
        <YAxis
          tick={{ fontSize: 11, fill: LUXURY_CHART.axis }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={40}
        />
        <Tooltip
          cursor={{
            stroke: BRAND.gold,
            strokeWidth: 1,
            strokeDasharray: '4 6',
            strokeOpacity: 0.4,
          }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0]?.payload as ChartDayRow | undefined
            const title = row ? `${row.dayLabel} · ${row.shortDate}` : String(label ?? '')
            const rows = [
              {
                label: t('aiPredictive.chartPredicted'),
                value: String(row?.predictedCovers ?? 0),
                tone: 'gold' as const,
              },
              {
                label: t('aiPredictive.chartHistorical'),
                value: String(row?.baseCovers ?? 0),
                tone: 'gold' as const,
              },
            ]
            if (row && row.weatherImpactPct !== 0) {
              rows.push({
                label: t('aiPredictive.chart.weatherImpact'),
                value: `${row.weatherImpactPct > 0 ? '+' : ''}${row.weatherImpactPct}%`,
                tone: 'gold' as const,
              })
            }
            if (row) {
              rows.push({
                label: t('aiPredictive.confidenceLabel'),
                value: `${row.confidence}%`,
                tone: 'gold' as const,
              })
            }
            if (hasReservationData && row?.reservedCovers != null) {
              rows.push({
                label: t('aiPredictive.chart.reserved'),
                value: String(row.reservedCovers),
                tone: 'gold' as const,
              })
            }
            if (hasReservationData && row?.walkInCovers != null) {
              rows.push({
                label: t('aiPredictive.chart.walkIn'),
                value: String(row.walkInCovers),
                tone: 'gold' as const,
              })
            }
            return <LuxuryGlassTooltip title={title} rows={rows} />
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="line"
          wrapperStyle={{ paddingBottom: 12 }}
          formatter={value => {
            const labels: Record<string, string> = {
              predictedCovers: t('aiPredictive.chartPredicted'),
              baseCovers: t('aiPredictive.chartHistorical'),
              reservedCovers: t('aiPredictive.chart.reserved'),
              walkInCovers: t('aiPredictive.chart.walkIn'),
            }
            return <span className="text-xs text-fumo">{labels[String(value)] ?? value}</span>
          }}
        />
        <Area
          type="monotone"
          dataKey="predictedCovers"
          name="predictedCovers"
          stroke={ACCENT_STROKES.gold}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ r: 4, fill: ACCENT_STROKES.gold, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: ACCENT_STROKES.gold, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="baseCovers"
          name="baseCovers"
          stroke={ACCENT_STROKES.champagne}
          strokeWidth={2}
          strokeDasharray="6 5"
          dot={false}
        />
        {hasReservationData && (
          <>
            <Line
              type="monotone"
              dataKey="reservedCovers"
              name="reservedCovers"
              stroke={ACCENT_STROKES.emerald}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="walkInCovers"
              name="walkInCovers"
              stroke={ACCENT_STROKES.violet}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
