import { lazy } from 'react'

/** Recharts caricato solo quando un grafico entra nel viewport route (chunk separato). */
export const LuxuryAreaChart = lazy(() => import('./LuxuryAreaChart'))
export const LuxuryBarChart = lazy(() => import('./LuxuryBarChart'))
export const LuxuryLineChart = lazy(() => import('./LuxuryLineChart'))
