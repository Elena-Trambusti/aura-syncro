import { z } from 'zod'
import { PosIntegrationMode } from '@prisma/client'

export const onboardingTableSchema = z.object({
  label: z.string().min(1).max(40),
  seats: z.number().int().min(1).max(24),
})

export const onboardingAreaSchema = z.object({
  name: z.string().min(1).max(80),
  tables: z.array(onboardingTableSchema).min(1).max(80),
})

export const onboardingIntakeSchema = z.object({
  fiscal: z.object({
    restaurantName: z.string().min(2).max(120),
    legalName: z.string().min(2).max(200),
    taxId: z.string().min(8).max(32),
    address: z.string().min(5).max(500),
    email: z.string().email(),
    phone: z.string().min(6).max(32),
  }),
  room: z.object({
    totalSeats: z.number().int().min(1).max(2000),
    areas: z.array(onboardingAreaSchema).min(1).max(20),
  }),
  menu: z.object({
    cuisineType: z.string().min(2).max(80),
    detailsText: z.string().max(8000).optional(),
    menuFileName: z.string().max(255).optional(),
    menuFileMime: z.string().max(100).optional(),
    menuFileSize: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  }),
  hardware: z.object({
    cashPoints: z.number().int().min(1).max(20),
    printersKitchen: z.number().int().min(0).max(20),
    printersBar: z.number().int().min(0).max(20),
    printersCash: z.number().int().min(0).max(20),
    posPreference: z.nativeEnum(PosIntegrationMode).optional(),
    posNotes: z.string().max(2000).optional(),
  }),
  appointment: z.object({
    slotStart: z.string().datetime(),
    notes: z.string().max(1000).optional(),
  }),
})

export type OnboardingIntakePayload = z.infer<typeof onboardingIntakeSchema>
