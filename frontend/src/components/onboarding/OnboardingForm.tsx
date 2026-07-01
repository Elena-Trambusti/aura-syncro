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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-0.5 text-amber-600">*</span>}
    </label>
  )
}

function inputClass(hasError?: boolean) {
  return cn(
    'w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors',
    'placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20',
    hasError ? 'border-red-300' : 'border-slate-200',
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
      {/* Progress header */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-8">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('onboardingForm.badge')}
            </p>
            <p className="text-sm font-medium text-slate-900">
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
                  'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors sm:px-2',
                  active && 'bg-white shadow-sm ring-1 ring-amber-500/30',
                  done && !active && 'opacity-80',
                  !active && !done && 'opacity-50',
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-amber-600' : 'text-slate-400')} />
                <span className={cn('hidden text-[10px] font-medium sm:block', active ? 'text-slate-900' : 'text-slate-500')}>
                  {t(`onboardingForm.steps.${id}`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step body */}
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-200">
            <StepIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t(`onboardingForm.steps.${step}`)}</h3>
            <p className="text-sm text-slate-500">{t(`onboardingForm.steps.${step}Hint`)}</p>
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {t('onboardingForm.fields.totalSeats')}: <strong>{computedSeats}</strong>
              {errors.totalSeats && <span className="ml-2 text-red-600">{errors.totalSeats}</span>}
            </div>
            {form.room.areas.map((area, ai) => (
              <div key={ai} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
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
                    <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      onClick={() => syncTotalSeats(form.room.areas.filter((_, i) => i !== ai))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {area.tables.map((table, ti) => (
                    <div key={ti} className="flex gap-2">
                      <input className={inputClass()} value={table.label} disabled={readOnly}
                        placeholder={t('onboardingForm.fields.tableLabel')}
                        onChange={e => {
                          const areas = [...form.room.areas]
                          const tables = [...areas[ai].tables]
                          tables[ti] = { ...tables[ti], label: e.target.value }
                          areas[ai] = { ...areas[ai], tables }
                          syncTotalSeats(areas)
                        }} />
                      <input type="number" min={1} max={24} className={cn(inputClass(), 'w-24')} value={table.seats} disabled={readOnly}
                        onChange={e => {
                          const areas = [...form.room.areas]
                          const tables = [...areas[ai].tables]
                          tables[ti] = { ...tables[ti], seats: Number(e.target.value) || 1 }
                          areas[ai] = { ...areas[ai], tables }
                          syncTotalSeats(areas)
                        }} />
                      {!readOnly && area.tables.length > 1 && (
                        <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50"
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
                  <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
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
              <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                onClick={() => syncTotalSeats([...form.room.areas, { name: t('onboardingForm.fields.newArea'), tables: [{ label: 'T1', seats: 4 }] }])}>
                <Plus className="h-4 w-4" /> {t('onboardingForm.actions.addArea')}
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
                'rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50',
                errors.menu && 'border-red-300',
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                if (!readOnly) handleMenuFile(e.dataTransfer.files[0] ?? null)
              }}
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-800">{t('onboardingForm.menu.dropTitle')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('onboardingForm.menu.dropHint')}</p>
              {!readOnly && (
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                  {t('onboardingForm.menu.browse')}
                  <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={e => handleMenuFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {form.menu.menuFile && (
                <p className="mt-3 text-sm text-emerald-700">{form.menu.menuFile.name}</p>
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
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-8">
          <button type="button" onClick={goBack} disabled={stepIndex === 0}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" /> {t('onboardingForm.actions.back')}
          </button>
          <button type="button" onClick={goNext} disabled={submitMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60">
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLast ? t('onboardingForm.actions.submit') : t('onboardingForm.actions.next')}
            {!isLast && !submitMutation.isPending && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
