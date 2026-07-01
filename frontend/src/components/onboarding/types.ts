export type OnboardingTableDraft = {
  label: string
  seats: number
}

export type OnboardingAreaDraft = {
  name: string
  tables: OnboardingTableDraft[]
}

export type OnboardingFormState = {
  fiscal: {
    restaurantName: string
    legalName: string
    taxId: string
    address: string
    email: string
    phone: string
  }
  room: {
    totalSeats: number
    areas: OnboardingAreaDraft[]
  }
  menu: {
    cuisineType: string
    detailsText: string
    menuFile: File | null
  }
  hardware: {
    cashPoints: number
    printersKitchen: number
    printersBar: number
    printersCash: number
    posPreference: 'PENDING_SETUP' | 'SIMULATION' | 'STRIPE_TERMINAL' | 'EXTERNAL'
    posNotes: string
  }
  appointment: {
    slotStart: string
    notes: string
  }
}

export const ONBOARDING_STEPS = ['fiscal', 'room', 'menu', 'hardware', 'calendar'] as const
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

export function createEmptyOnboardingForm(defaults?: Partial<OnboardingFormState>): OnboardingFormState {
  const areas = defaults?.room?.areas ?? [
    { name: 'Sala Interna', tables: [{ label: 'T1', seats: 4 }] },
  ]
  return {
    fiscal: {
      restaurantName: defaults?.fiscal?.restaurantName ?? '',
      legalName: defaults?.fiscal?.legalName ?? '',
      taxId: defaults?.fiscal?.taxId ?? '',
      address: defaults?.fiscal?.address ?? '',
      email: defaults?.fiscal?.email ?? '',
      phone: defaults?.fiscal?.phone ?? '',
    },
    room: {
      totalSeats: defaults?.room?.totalSeats ?? computeAreaSeats(areas),
      areas,
    },
    menu: {
      cuisineType: defaults?.menu?.cuisineType ?? '',
      detailsText: defaults?.menu?.detailsText ?? '',
      menuFile: null,
    },
    hardware: {
      cashPoints: defaults?.hardware?.cashPoints ?? 1,
      printersKitchen: defaults?.hardware?.printersKitchen ?? 1,
      printersBar: defaults?.hardware?.printersBar ?? 0,
      printersCash: defaults?.hardware?.printersCash ?? 1,
      posPreference: defaults?.hardware?.posPreference ?? 'PENDING_SETUP',
      posNotes: defaults?.hardware?.posNotes ?? '',
    },
    appointment: {
      slotStart: defaults?.appointment?.slotStart ?? '',
      notes: defaults?.appointment?.notes ?? '',
    },
  }
}

export function computeAreaSeats(areas: OnboardingAreaDraft[]): number {
  return areas.reduce((sum, area) => sum + area.tables.reduce((s, t) => s + t.seats, 0), 0)
}
