import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import {
  Building2,
  CalendarHeart,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '../../lib/api'
import { formatApiError } from '../../lib/errors'
import { cn } from '../../lib/utils'
import SetupCalendar from './SetupCalendar'
import {
  ONBOARDING_STEPS,
  type OnboardingFormState,
  type OnboardingStepId,
  computeAreaSeats,
  createEmptyOnboardingForm,
} from './types'

type Props = {
  initial?: Partial<OnboardingFormState>
  onSubmitted?: () => void
  readOnly?: boolean
}

const STEP_ICONS: Record<OnboardingStepId, typeof Building2> = {
  fiscal: Building2,
  room: ChefHat,
  menu: Upload,
  hardware: Cpu,
  calendar: CalendarHeart,
}

const CUISINE_KEYS = ['pizzeria', 'gourmet', 'meat', 'fish', 'regional', 'fusion', 'other'] as const

function inputClass(hasError?: boolean) {
  return cn(
    'w-full rounded-xl border bg-[#111111] px-4 py-3 text-sm text-white shadow-sm transition-colors',
    'placeholder:text-gray-500 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20',
    hasError ? 'border-red-500/50' : 'border-[#333333]',
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-gray-300">
      {children}
      {required && <span className="ml-0.5 text-[#D4AF37]">*</span>}
    </label>
  )
}

export default function OnboardingForm({ initial, onSubmitted, readOnly = false }: Props) {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<OnboardingFormState>(() => createEmptyOnboardingForm(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (initial) setForm(createEmptyOnboardingForm(initial))
  }, [initial])

  const step = ONBOARDING_STEPS[stepIndex]
  const StepIcon = STEP_ICONS[step]
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1

  const computedSeats = useMemo(() => computeAreaSeats(form.room.areas), [form.room.areas])

  const syncTotalSeats = useCallback((areas = form.room.areas) => {
    setForm(prev => ({ ...prev, room: { ...prev.room, areas, totalSeats: computeAreaSeats(areas) } }))
  }, [form.room.areas])

  const validateStep = (id: OnboardingStepId): boolean => {
    const next: Record<string, string> = {}
    if (id === 'fiscal') {
      if (!form.fiscal.restaurantName.trim()) next.restaurantName = t('onboardingForm.errors.required')
      if (!form.fiscal.legalName.trim()) next.legalName = t('onboardingForm.errors.required')
      if (!form.fiscal.taxId.trim()) next.taxId = t('onboardingForm.errors.required')
      if (!form.fiscal.address.trim()) next.address = t('onboardingForm.errors.required')
      if (!form.fiscal.email.trim()) next.email = t('onboardingForm.errors.required')
      if (!form.fiscal.phone.trim()) next.phone = t('onboardingForm.errors.required')
    }
    if (id === 'room') {
      if (form.room.areas.length === 0) next.areas = t('onboardingForm.errors.areaRequired')
      form.room.areas.forEach((area, ai) => {
        if (!area.name.trim()) next[`area-${ai}-name`] = t('onboardingForm.errors.required')
        if (area.tables.length === 0) next[`area-${ai}-tables`] = t('onboardingForm.errors.tableRequired')
      })
      if (computedSeats !== form.room.totalSeats) next.totalSeats = t('onboardingForm.errors.seatsMismatch')
    }
    if (id === 'menu') {
      if (!form.menu.cuisineType) next.cuisineType = t('onboardingForm.errors.required')
      if (!form.menu.menuFile && !form.menu.detailsText.trim()) next.menu = t('onboardingForm.errors.menuRequired')
    }
    if (id === 'hardware') {
      if (form.hardware.cashPoints < 1) next.cashPoints = t('onboardingForm.errors.required')
    }
    if (id === 'calendar') {
      if (!form.appointment.slotStart) next.slotStart = t('onboardingForm.errors.slotRequired')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fiscal: form.fiscal,
        room: { ...form.room, totalSeats: computedSeats },
        menu: {
          cuisineType: form.menu.cuisineType,
          detailsText: form.menu.detailsText || undefined,
        },
        hardware: form.hardware,
        appointment: {
          slotStart: form.appointment.slotStart,
          notes: form.appointment.notes || undefined,
        },
      }
      const body = new FormData()
      body.append('payload', JSON.stringify(payload))
      if (form.menu.menuFile) body.append('menuFile', form.menu.menuFile)
      return api.post('/restaurant/onboarding/complete', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success(t('onboardingForm.submitSuccess'))
      onSubmitted?.()
    },
    onError: (err: unknown) => {
      toast.error(formatApiError(err))
    },
  })

  const goNext = () => {
    if (readOnly) return
    if (!validateStep(step)) return
    if (isLast) {
      submitMutation.mutate()
      return
    }
    setStepIndex(i => Math.min(i + 1, ONBOARDING_STEPS.length - 1))
  }

  const goBack = () => setStepIndex(i => Math.max(i - 1, 0))

  const handleMenuFile = (file: File | null) => {
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error(t('onboardingForm.errors.invalidFileType'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('onboardingForm.errors.fileTooLarge'))
      return
    }
    setForm(prev => ({ ...prev, menu: { ...prev.menu, menuFile: file } }))
  }

  return (
    <div className="rounded-2xl border border-[#333333] bg-[#0A0A0A] shadow-2xl overflow-hidden">
      {/* Progress header */}
      <div className="border-b border-[#333333] bg-[#111111] px-4 py-5 sm:px-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#AA8A2E] shadow-lg shadow-[#D4AF37]/10">
            <Zap className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
              {t('onboardingForm.badge', { defaultValue: 'Concierge Aura Syncro' })}
            </p>
            <p className="text-base font-serif text-white tracking-wide">
              {t('onboardingForm.stepProgress', { current: stepIndex + 1, total: ONBOARDING_STEPS.length })}
            </p>
          </div>
        </div>
        <div className="flex gap-1 sm:gap-2">
          {ONBOARDING_STEPS.map((id, i) => {
            const Icon = STEP_ICONS[id]
            const active = i === stepIndex
            const done = i < stepIndex
            return (
              <button
                key={id}
                type="button"
                disabled={readOnly || i > stepIndex}
                onClick={() => i <= stepIndex && setStepIndex(i)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-all duration-300',
                  active && 'bg-[#222222] shadow-sm ring-1 ring-[#D4AF37]/50',
                  done && !active && 'opacity-70 hover:opacity-100 hover:bg-[#1A1A1A]',
                  !active && !done && 'opacity-30',
                )}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-[#D4AF37]' : 'text-gray-400')} />
                <span className={cn('hidden text-[10px] font-medium uppercase tracking-wider sm:block', active ? 'text-[#D4AF37]' : 'text-gray-400')}>
                  {t(`onboardingForm.steps.${id}`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step body */}
      <div className="px-4 py-8 sm:px-8 sm:py-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#222222] ring-1 ring-[#D4AF37]/30">
            <StepIcon className="h-6 w-6 text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-xl font-serif text-white tracking-wide">{t(`onboardingForm.steps.${step}`)}</h3>
            <p className="text-sm text-gray-400 mt-1">{t(`onboardingForm.steps.${step}Hint`)}</p>
          </div>
        </div>

        {step === 'fiscal' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel required>{t('onboardingForm.fields.restaurantName')}</FieldLabel>
              <input className={inputClass(!!errors.restaurantName)} value={form.fiscal.restaurantName} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, restaurantName: e.target.value } }))} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>{t('onboardingForm.fields.legalName')}</FieldLabel>
              <input className={inputClass(!!errors.legalName)} value={form.fiscal.legalName} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, legalName: e.target.value } }))} />
            </div>
            <div>
              <FieldLabel required>{t('onboardingForm.fields.taxId')}</FieldLabel>
              <input className={inputClass(!!errors.taxId)} value={form.fiscal.taxId} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, taxId: e.target.value } }))} />
            </div>
            <div>
              <FieldLabel required>{t('onboardingForm.fields.phone')}</FieldLabel>
              <input className={inputClass(!!errors.phone)} value={form.fiscal.phone} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, phone: e.target.value } }))} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>{t('onboardingForm.fields.address')}</FieldLabel>
              <input className={inputClass(!!errors.address)} value={form.fiscal.address} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, address: e.target.value } }))} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>{t('onboardingForm.fields.email')}</FieldLabel>
              <input type="email" className={inputClass(!!errors.email)} value={form.fiscal.email} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, fiscal: { ...p.fiscal, email: e.target.value } }))} />
            </div>
          </div>
        )}

        {step === 'room' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#333333] bg-[#111111] px-5 py-4 text-sm text-gray-300 flex items-center justify-between">
              <span>{t('onboardingForm.fields.totalSeats')}: <strong className="text-[#D4AF37] text-lg ml-2">{computedSeats}</strong></span>
              {errors.totalSeats && <span className="ml-2 text-red-500">{errors.totalSeats}</span>}
            </div>
            {form.room.areas.map((area, ai) => (
              <div key={ai} className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <input
                    className={inputClass(!!errors[`area-${ai}-name`])}
                    value={area.name}
                    disabled={readOnly}
                    placeholder={t('onboardingForm.fields.areaName')}
                    onChange={e => {
                      const areas = [...form.room.areas]
                      areas[ai] = { ...areas[ai], name: e.target.value }
                      syncTotalSeats(areas)
                    }}
                  />
                  {!readOnly && form.room.areas.length > 1 && (
                    <button type="button" className="rounded-xl p-3 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      onClick={() => syncTotalSeats(form.room.areas.filter((_, i) => i !== ai))}>
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {area.tables.map((table, ti) => (
                    <div key={ti} className="flex gap-3 items-center">
                      <input className={inputClass()} value={table.label} disabled={readOnly}
                        placeholder={t('onboardingForm.fields.tableLabel')}
                        onChange={e => {
                          const areas = [...form.room.areas]
                          const tables = [...areas[ai].tables]
                          tables[ti] = { ...tables[ti], label: e.target.value }
                          areas[ai] = { ...areas[ai], tables }
                          syncTotalSeats(areas)
                        }} />
                      <input type="number" min={1} max={50} className={cn(inputClass(), 'w-24')} value={table.seats} disabled={readOnly}
                        onChange={e => {
                          const areas = [...form.room.areas]
                          const tables = [...areas[ai].tables]
                          tables[ti] = { ...tables[ti], seats: Number(e.target.value) || 1 }
                          areas[ai] = { ...areas[ai], tables }
                          syncTotalSeats(areas)
                        }} />
                      {!readOnly && area.tables.length > 1 && (
                        <button type="button" className="rounded-lg p-2 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                          onClick={() => {
                            const areas = [...form.room.areas]
                            areas[ai] = { ...areas[ai], tables: areas[ai].tables.filter((_, i) => i !== ti) }
                            syncTotalSeats(areas)
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#D4AF37] hover:text-[#AA8A2E] transition-colors"
                    onClick={() => {
                      const areas = [...form.room.areas]
                      const n = areas[ai].tables.length + 1
                      areas[ai] = { ...areas[ai], tables: [...areas[ai].tables, { label: `T${n}`, seats: 4 }] }
                      syncTotalSeats(areas)
                    }}>
                    <Plus className="h-4 w-4" /> {t('onboardingForm.actions.addTable')}
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button type="button" className="w-full justify-center inline-flex items-center gap-2 rounded-xl border border-dashed border-[#333333] px-4 py-4 text-sm font-medium text-[#D4AF37] hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 transition-all"
                onClick={() => syncTotalSeats([...form.room.areas, { name: t('onboardingForm.fields.newArea'), tables: [{ label: 'T1', seats: 4 }] }])}>
                <Plus className="h-5 w-5" /> {t('onboardingForm.actions.addArea')}
              </button>
            )}
          </div>
        )}

        {step === 'menu' && (
          <div className="space-y-5">
            <div>
              <FieldLabel required>{t('onboardingForm.fields.cuisineType')}</FieldLabel>
              <select className={inputClass(!!errors.cuisineType)} value={form.menu.cuisineType} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, menu: { ...p.menu, cuisineType: e.target.value } }))}>
                <option value="">{t('onboardingForm.fields.selectCuisine')}</option>
                {CUISINE_KEYS.map(k => (
                  <option key={k} value={k}>{t(`onboardingForm.cuisine.${k}`)}</option>
                ))}
              </select>
            </div>
            <div
              className={cn(
                'rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300',
                dragOver ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-[#333333] bg-[#111111]',
                errors.menu && 'border-red-500/50',
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                if (!readOnly) handleMenuFile(e.dataTransfer.files[0] ?? null)
              }}
            >
              <Upload className="mx-auto mb-4 h-10 w-10 text-[#D4AF37]" />
              <p className="text-base font-serif text-white">{t('onboardingForm.menu.dropTitle')}</p>
              <p className="mt-2 text-sm text-gray-400">{t('onboardingForm.menu.dropHint')}</p>
              {!readOnly && (
                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] px-6 py-3 text-sm font-bold text-black shadow-lg hover:shadow-[#D4AF37]/20 transition-all">
                  {t('onboardingForm.menu.browse')}
                  <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={e => handleMenuFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {form.menu.menuFile && (
                <p className="mt-4 text-sm font-medium text-emerald-400">{form.menu.menuFile.name}</p>
              )}
            </div>
            <div>
              <FieldLabel>{t('onboardingForm.fields.menuDetails')}</FieldLabel>
              <textarea rows={5} className={inputClass(!!errors.menu)} value={form.menu.detailsText} disabled={readOnly}
                placeholder={t('onboardingForm.fields.menuDetailsPlaceholder')}
                onChange={e => setForm(p => ({ ...p, menu: { ...p.menu, detailsText: e.target.value } }))} />
            </div>
          </div>
        )}

        {step === 'hardware' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel required>{t('onboardingForm.fields.cashPoints')}</FieldLabel>
              <input type="number" min={1} className={inputClass(!!errors.cashPoints)} value={form.hardware.cashPoints} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, cashPoints: Number(e.target.value) || 1 } }))} />
            </div>
            <div>
              <FieldLabel>{t('onboardingForm.fields.posPreference')}</FieldLabel>
              <select className={inputClass()} value={form.hardware.posPreference} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, posPreference: e.target.value as OnboardingFormState['hardware']['posPreference'] } }))}>
                <option value="PENDING_SETUP">{t('onboardingForm.pos.pending')}</option>
                <option value="STRIPE_TERMINAL">{t('onboardingForm.pos.stripe')}</option>
                <option value="EXTERNAL">{t('onboardingForm.pos.external')}</option>
                <option value="SIMULATION">{t('onboardingForm.pos.simulation')}</option>
              </select>
            </div>
            <div>
              <FieldLabel>{t('onboardingForm.fields.printersKitchen')}</FieldLabel>
              <input type="number" min={0} className={inputClass()} value={form.hardware.printersKitchen} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, printersKitchen: Number(e.target.value) || 0 } }))} />
            </div>
            <div>
              <FieldLabel>{t('onboardingForm.fields.printersBar')}</FieldLabel>
              <input type="number" min={0} className={inputClass()} value={form.hardware.printersBar} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, printersBar: Number(e.target.value) || 0 } }))} />
            </div>
            <div>
              <FieldLabel>{t('onboardingForm.fields.printersCash')}</FieldLabel>
              <input type="number" min={0} className={inputClass()} value={form.hardware.printersCash} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, printersCash: Number(e.target.value) || 0 } }))} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>{t('onboardingForm.fields.posNotes')}</FieldLabel>
              <textarea rows={3} className={inputClass()} value={form.hardware.posNotes} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, hardware: { ...p.hardware, posNotes: e.target.value } }))} />
            </div>
          </div>
        )}

        {step === 'calendar' && (
          <div className="space-y-4">
            <SetupCalendar
              value={form.appointment.slotStart}
              onChange={iso => setForm(p => ({ ...p, appointment: { ...p.appointment, slotStart: iso } }))}
            />
            {errors.slotStart && <p className="text-sm text-red-600">{errors.slotStart}</p>}
            <div>
              <FieldLabel>{t('onboardingForm.fields.appointmentNotes')}</FieldLabel>
              <textarea rows={3} className={inputClass()} value={form.appointment.notes} disabled={readOnly}
                onChange={e => setForm(p => ({ ...p, appointment: { ...p.appointment, notes: e.target.value } }))} />
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-3 border-t border-[#333333] bg-[#0A0A0A] px-4 py-5 sm:px-8">
          <button type="button" onClick={goBack} disabled={stepIndex === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-[#111111] px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:bg-[#222222] hover:text-white disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> {t('onboardingForm.actions.back')}
          </button>
          <button type="button" onClick={goNext} disabled={submitMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] px-8 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#D4AF37]/20 transition-all hover:brightness-110 disabled:opacity-60">
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLast ? t('onboardingForm.actions.submit') : t('onboardingForm.actions.next')}
            {!isLast && !submitMutation.isPending && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
