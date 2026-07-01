import { Router, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { AuthRequest, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { listSetupSlots } from '../lib/onboardingSlots'
import { onboardingIntakeSchema } from '../lib/onboardingIntakeSchema'
import { persistOnboardingIntake } from '../lib/onboardingPersist'

export const onboardingRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('INVALID_MENU_FILE_TYPE'))
  },
})

onboardingRouter.get('/intake', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.restaurantSettings.findUnique({
      where: { restaurantId: req.restaurantId! },
      select: {
        onboardingIntake: true,
        onboardingSubmittedAt: true,
        onboardingConcierge: true,
      },
    })
    let appointment: { id: string; slotStart: Date; slotEnd: Date; status: string } | null = null
    try {
      appointment = await prisma.setupAppointment.findUnique({
        where: { restaurantId: req.restaurantId! },
        select: {
          id: true,
          slotStart: true,
          slotEnd: true,
          status: true,
        },
      })
    } catch {
      /* tabella SetupAppointment assente se migration non applicata */
    }
    res.json({
      submittedAt: settings?.onboardingSubmittedAt ?? null,
      intake: settings?.onboardingIntake ?? null,
      concierge: settings?.onboardingConcierge ?? null,
      appointment,
    })
  } catch (err: unknown) {
    console.error('[onboarding/intake]', err)
    res.status(503).json({
      error: 'ONBOARDING_NOT_READY',
      code: 'ONBOARDING_NOT_READY',
      message: 'Modulo onboarding non disponibile. Applicare la migration database.',
    })
  }
})

onboardingRouter.get('/setup-slots', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }).safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_DATE_RANGE', code: 'INVALID_DATE_RANGE' })
    return
  }
  const slots = await listSetupSlots(parsed.data.from, parsed.data.to)
  res.json({ slots })
})

onboardingRouter.post(
  '/complete',
  requireRole('OWNER', 'MANAGER'),
  upload.single('menuFile'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    let body: unknown = req.body
    if (typeof req.body.payload === 'string') {
      try {
        body = JSON.parse(req.body.payload)
      } catch {
        res.status(400).json({ error: 'INVALID_JSON', code: 'INVALID_JSON' })
        return
      }
    }

    const parsed = onboardingIntakeSchema.safeParse(body)
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
      return
    }

    if (!req.file && !parsed.data.menu.detailsText?.trim()) {
      res.status(400).json({
        error: 'MENU_REQUIRED',
        code: 'MENU_REQUIRED',
        field: 'menu',
      })
      return
    }

    try {
      const result = await persistOnboardingIntake({
        restaurantId: req.restaurantId!,
        payload: parsed.data,
        menuFile: req.file
          ? { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype }
          : undefined,
      })

      if (!result.ok) {
        const status = result.code === 'ALREADY_SUBMITTED' ? 409 : 400
        res.status(status).json({ error: result.code, code: result.code, field: result.field })
        return
      }

      res.status(201).json({
        success: true,
        appointmentId: result.appointmentId,
        message: 'Onboarding submitted',
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INVALID_MENU_FILE_TYPE') {
        res.status(400).json({ error: 'INVALID_MENU_FILE_TYPE', code: 'INVALID_MENU_FILE_TYPE' })
        return
      }
      throw err
    }
  },
)
