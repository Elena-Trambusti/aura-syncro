import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../hooks/useRole'
import { api } from '../lib/api'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import OnboardingForm from '../components/onboarding/OnboardingForm'
import type { OnboardingFormState } from '../components/onboarding/types'

type ReadinessCheck = { id: string; ok: boolean; detail?: string }

type OnboardingReadiness = {
  readyForService: boolean
  checks: ReadinessCheck[]
  menuItemCount: number
  tableCount: number
  posMode: string
  cashSessionOpen: boolean
}

type IntakeResponse = {
  submittedAt: string | null
  intake: Record<string, unknown> | null
  appointment: { slotStart: string; slotEnd: string; status: string } | null
}

export default function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const { restaurant, refreshRestaurant } = useAuth()
  const { canAccessAdminNav } = useRole()
  const isAdmin = canAccessAdminNav()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: readiness, isLoading: readinessLoading, refetch: refetchReadiness } = useQuery<OnboardingReadiness>({
    queryKey: ['onboarding-readiness', restaurant?.id],
    queryFn: () => api.get('/restaurant/onboarding-readiness').then(r => r.data),
    enabled: Boolean(restaurant?.id) && isAdmin,
    refetchInterval: isAdmin ? 15_000 : false,
  })

  const {
    data: intakeData,
    isError: intakeLoadError,
    refetch: refetchIntake,
  } = useQuery<IntakeResponse>({
    queryKey: ['onboarding-intake', restaurant?.id],
    queryFn: () => api.get('/restaurant/onboarding/intake').then(r => r.data),
    enabled: Boolean(restaurant?.id) && isAdmin,
    retry: false,
  })

  const { data: restaurantDetails } = useQuery({
    queryKey: ['restaurant-details', restaurant?.id],
    queryFn: () => api.get('/restaurant').then(r => r.data),
    enabled: Boolean(restaurant?.id) && isAdmin,
  })

  const formDefaults = useMemo((): Partial<OnboardingFormState> | undefined => {
    if (!restaurant) return undefined
    const intake = intakeData?.intake as Partial<OnboardingFormState> | null
    const settings = restaurantDetails?.settings as { legalName?: string; taxId?: string } | undefined
    return {
      fiscal: {
        restaurantName: restaurant.name ?? '',
        legalName: (intake?.fiscal as OnboardingFormState['fiscal'] | undefined)?.legalName ?? settings?.legalName ?? '',
        taxId: settings?.taxId ?? restaurant.taxId ?? '',
        address: restaurantDetails?.address ?? '',
        email: restaurantDetails?.email ?? '',
        phone: restaurantDetails?.phone ?? '',
      },
      ...(intake ?? {}),
    }
  }, [restaurant, intakeData?.intake, restaurantDetails])

  const isSubmitted = Boolean(intakeData?.submittedAt)

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      toast.success(t('onboarding.welcomeToast'))
      setSearchParams({}, { replace: true })
      void refreshRestaurant()
      void refetchReadiness()
      void refetchIntake()
    }
  }, [searchParams, setSearchParams, t, refreshRestaurant, refetchReadiness, refetchIntake])

  useEffect(() => {
    const fast = searchParams.get('welcome') === 'true' || restaurant?.hasActiveSubscription === false
    const ms = fast ? 5_000 : 30_000
    const interval = window.setInterval(() => {
      void refreshRestaurant()
      void refetchReadiness()
    }, ms)
    return () => window.clearInterval(interval)
  }, [refreshRestaurant, refetchReadiness, searchParams, restaurant?.hasActiveSubscription])

  const systemDone = readiness?.checks.filter(c => c.ok).length ?? 0
  const systemTotal = readiness?.checks.length ?? 0
  const checkLabel = (id: string) => t(`onboarding.systemChecks.${id}`, { defaultValue: id })

  return (
    <ExecutivePageShell className="mx-auto max-w-4xl space-y-8 pb-8">
      <ExecutivePageHeader
        title={t('onboarding.title')}
        subtitle={t('onboarding.subtitle', { name: restaurant?.name ?? '' })}
        eyebrow={t('onboarding.badge')}
      />

      {isAdmin && (
        <>
          {intakeLoadError ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-semibold">{t('onboardingForm.loadErrorTitle', { defaultValue: 'Modulo onboarding non ancora attivo' })}</p>
              <p className="mt-2">{t('onboardingForm.loadErrorHint', { defaultValue: 'Il server deve essere aggiornato con la nuova versione e la migration database. Se stai in locale, avvia il backend e lancia: npx prisma migrate deploy' })}</p>
            </section>
          ) : !isSubmitted ? (
            <OnboardingForm
              initial={formDefaults}
              onSubmitted={() => {
                void refetchIntake()
                void refetchReadiness()
                void refreshRestaurant()
              }}
            />
          ) : (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <h2 className="font-bold text-emerald-900">{t('onboardingForm.submittedTitle')}</h2>
              <p className="mt-2 text-sm text-emerald-800">{t('onboardingForm.submittedHint')}</p>
              {intakeData?.appointment?.slotStart && (
                <p className="mt-3 text-sm font-medium text-emerald-900">
                  {t('onboardingForm.calendar.selected', {
                    datetime: new Date(intakeData.appointment.slotStart).toLocaleString(i18n.language, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })}
                </p>
              )}
            </section>
          )}
        </>
      )}

      {!isAdmin && (
        <p className="text-sm text-slate-500">{t('onboarding.staffConciergeHint')}</p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-slate-900">{t('onboarding.systemChecklistTitle')}</h2>
          {isAdmin && readinessLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        </div>
        {!isAdmin ? (
          <p className="text-sm text-slate-500">{t('onboarding.staffReadinessHint')}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              {t('onboarding.systemProgressLabel', { done: systemDone, total: systemTotal })}
            </p>
            <ul className="space-y-2">
              {(readiness?.checks ?? []).map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm"
                >
                  {item.ok
                    ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    : <Circle className="h-5 w-5 shrink-0 text-amber-500" />}
                  <span className={item.ok ? 'text-slate-500' : 'text-slate-900 font-medium'}>
                    {checkLabel(item.id)}
                  </span>
                  {item.detail && (
                    <span className="ml-auto text-xs text-slate-500">{item.detail}</span>
                  )}
                </li>
              ))}
            </ul>
            {readiness?.readyForService && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {t('onboarding.systemReady')}
              </p>
            )}
          </>
        )}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm leading-relaxed text-amber-900">{t('onboarding.teamNote')}</p>
      </div>
    </ExecutivePageShell>
  )
}
