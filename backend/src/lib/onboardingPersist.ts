import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { validateTaxId } from './validateTaxId'
import { isSetupSlotAvailable } from './onboardingSlots'
import type { OnboardingIntakePayload } from './onboardingIntakeSchema'

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'onboarding')

function buildPosSetupNotes(hardware: OnboardingIntakePayload['hardware']): string {
  const lines = [
    `Punti cassa: ${hardware.cashPoints}`,
    `Stampanti cucina: ${hardware.printersKitchen}`,
    `Stampanti bar: ${hardware.printersBar}`,
    `Stampanti cassa: ${hardware.printersCash}`,
  ]
  if (hardware.posNotes?.trim()) lines.push(hardware.posNotes.trim())
  return lines.join('\n')
}

export type PersistOnboardingOptions = {
  restaurantId: string
  payload: OnboardingIntakePayload
  menuFile?: { buffer: Buffer; originalname: string; mimetype: string }
}

export type PersistOnboardingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; code: string; field?: string }

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export async function persistOnboardingIntake(
  opts: PersistOnboardingOptions,
): Promise<PersistOnboardingResult> {
  const { restaurantId, payload } = opts

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true, setupAppointment: true },
  })
  if (!restaurant) return { ok: false, code: 'RESTAURANT_NOT_FOUND' }
  if (restaurant.setupAppointment?.status === 'CONFIRMED') {
    return { ok: false, code: 'ALREADY_SUBMITTED' }
  }

  const countryCode = restaurant.settings?.countryCode ?? 'IT'
  const taxCheck = validateTaxId(payload.fiscal.taxId, countryCode)
  if (!taxCheck.valid) {
    return { ok: false, code: taxCheck.code, field: 'fiscal.taxId' }
  }

  const slotOk = await isSetupSlotAvailable(payload.appointment.slotStart)
  if (!slotOk) {
    return { ok: false, code: 'SLOT_UNAVAILABLE', field: 'appointment.slotStart' }
  }

  const computedSeats = payload.room.areas.reduce(
    (sum, area) => sum + area.tables.reduce((s, t) => s + t.seats, 0),
    0,
  )
  if (computedSeats !== payload.room.totalSeats) {
    return { ok: false, code: 'SEATS_MISMATCH', field: 'room.totalSeats' }
  }

  let menuMeta: Record<string, unknown> = {}
  if (opts.menuFile) {
    const safeName = sanitizeFileName(opts.menuFile.originalname)
    const dir = path.join(UPLOAD_ROOT, restaurantId)
    await mkdir(dir, { recursive: true })
    const storedName = `menu-${Date.now()}-${safeName}`
    const fullPath = path.join(dir, storedName)
    await writeFile(fullPath, opts.menuFile.buffer)
    menuMeta = {
      menuFileName: opts.menuFile.originalname,
      menuFileMime: opts.menuFile.mimetype,
      menuFileSize: opts.menuFile.buffer.length,
      menuFilePath: path.relative(process.cwd(), fullPath),
    }
  }

  const intakeJson: Prisma.InputJsonValue = {
    ...payload,
    menu: { ...payload.menu, ...menuMeta },
    submittedCountryCode: countryCode,
    normalizedTaxId: taxCheck.normalized,
  }

  const slotStart = new Date(payload.appointment.slotStart)
  const slotEnd = new Date(slotStart.getTime() + 30 * 60_000)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          name: payload.fiscal.restaurantName,
          address: payload.fiscal.address,
          email: payload.fiscal.email,
          phone: payload.fiscal.phone,
        },
      })

      await tx.restaurantSettings.upsert({
        where: { restaurantId },
        update: {
          legalName: payload.fiscal.legalName,
          taxId: taxCheck.normalized,
          legalAddress: payload.fiscal.address,
          onboardingIntake: intakeJson,
          onboardingSubmittedAt: new Date(),
          onboardingConcierge: { menu: true, call: true, form: true },
          posIntegrationMode: payload.hardware.posPreference ?? undefined,
          posSetupNotes: buildPosSetupNotes(payload.hardware),
        },
        create: {
          restaurantId,
          legalName: payload.fiscal.legalName,
          taxId: taxCheck.normalized,
          legalAddress: payload.fiscal.address,
          onboardingIntake: intakeJson,
          onboardingSubmittedAt: new Date(),
          onboardingConcierge: { menu: true, call: true, form: true },
          posIntegrationMode: payload.hardware.posPreference ?? 'PENDING_SETUP',
          posSetupNotes: buildPosSetupNotes(payload.hardware),
        },
      })

      const existingTables = await tx.table.count({ where: { restaurantId } })
      if (existingTables === 0) {
        let tableNumber = 1
        for (const area of payload.room.areas) {
          for (const table of area.tables) {
            await tx.table.create({
              data: {
                restaurantId,
                number: tableNumber++,
                name: table.label,
                seats: table.seats,
                area: area.name,
                posX: ((tableNumber - 2) % 5) * 120,
                posY: Math.floor((tableNumber - 2) / 5) * 120,
              },
            })
          }
        }
      }

      await tx.setupAppointment.upsert({
        where: { restaurantId },
        create: {
          restaurantId,
          slotStart,
          slotEnd,
          contactEmail: payload.fiscal.email,
          contactPhone: payload.fiscal.phone,
          notes: payload.appointment.notes ?? null,
          status: 'CONFIRMED',
        },
        update: {
          slotStart,
          slotEnd,
          contactEmail: payload.fiscal.email,
          contactPhone: payload.fiscal.phone,
          notes: payload.appointment.notes ?? null,
          status: 'CONFIRMED',
        },
      })
    })
  } catch (err: unknown) {
    const prismaCode = (err as { code?: string })?.code
    if (prismaCode === 'P2002') {
      return { ok: false, code: 'SLOT_UNAVAILABLE', field: 'appointment.slotStart' }
    }
    throw err
  }

  const appt = await prisma.setupAppointment.findUnique({ where: { restaurantId } })
  return { ok: true, appointmentId: appt!.id }
}
