import { z } from 'zod'

export const MAX_REPORT_DAYS = 366

export const reportDaysQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(MAX_REPORT_DAYS).default(30),
})

export const reportYearMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(() => new Date().getMonth() + 1),
})

export const reportYearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
})

export const analyticsPeriodQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
})
