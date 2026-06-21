import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { ui } from '../lib/ui'
import AutomationCard from '../components/marketing/AutomationCard'
import { Cake, RefreshCw, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

type AutomationType = 'BIRTHDAY' | 'WIN_BACK' | 'VIP_THANKS'

interface MarketingAutomation {
  id: string
  type: AutomationType
  isActive: boolean
  messageTemplate: string
}

const AUTOMATION_META: Record<
  AutomationType,
  { icon: typeof Cake; titleKey: string; descKey: string }
> = {
  BIRTHDAY: { icon: Cake, titleKey: 'marketing.automations.birthday.title', descKey: 'marketing.automations.birthday.description' },
  WIN_BACK: { icon: RefreshCw, titleKey: 'marketing.automations.winBack.title', descKey: 'marketing.automations.winBack.description' },
  VIP_THANKS: { icon: Crown, titleKey: 'marketing.automations.vipThanks.title', descKey: 'marketing.automations.vipThanks.description' },
}

export default function MarketingPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const tk = useTenantQueryKey()

  const { data: automations = [], isLoading } = useQuery<MarketingAutomation[]>({
    queryKey: tq(tk, 'marketing', 'automations'),
    queryFn: () => api.get('/marketing/automations').then(r => r.data),
  })

  const saveAutomation = useMutation({
    mutationFn: ({ type, ...body }: { type: AutomationType; isActive?: boolean; messageTemplate?: string }) =>
      api.put(`/marketing/automations/${type}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'marketing', 'automations') })
      toast.success(t('marketing.automations.saved'))
    },
    onError: () => toast.error(t('marketing.automations.saveError')),
  })

  const ordered = useMemo(() => {
    const order: AutomationType[] = ['BIRTHDAY', 'WIN_BACK', 'VIP_THANKS']
    return order
      .map(type => automations.find(a => a.type === type))
      .filter(Boolean) as MarketingAutomation[]
  }, [automations])

  const updateLocal = (type: AutomationType, patch: Partial<MarketingAutomation>) => {
    qc.setQueryData<MarketingAutomation[]>(['marketing', 'automations'], prev =>
      (prev ?? []).map(a => (a.type === type ? { ...a, ...patch } : a)),
    )
  }

  const persist = (type: AutomationType, patch: { isActive?: boolean; messageTemplate?: string }) => {
    saveAutomation.mutate({ type, ...patch })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.pageTitle}>{t('marketing.title')}</h1>
        <p className={ui.pageSubtitle}>{t('marketing.subtitle')}</p>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t('marketing.automations.sectionTitle')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('marketing.automations.sectionSubtitle')}</p>
        </div>

        {isLoading ? (
          <div className={`${ui.cardSm} p-8 text-center text-sm text-slate-500`}>
            {t('common.loading')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {ordered.map(automation => {
              const meta = AUTOMATION_META[automation.type]
              const Icon = meta.icon
              return (
                <AutomationCard
                  key={automation.id}
                  title={t(meta.titleKey)}
                  description={t(meta.descKey)}
                  icon={<Icon className="h-5 w-5" />}
                  active={automation.isActive}
                  saving={saveAutomation.isPending}
                  messageTemplate={automation.messageTemplate}
                  templateLabel={t('marketing.automations.templateLabel')}
                  onToggle={active => {
                    updateLocal(automation.type, { isActive: active })
                    persist(automation.type, { isActive: active })
                  }}
                  onMessageChange={messageTemplate => {
                    updateLocal(automation.type, { messageTemplate })
                  }}
                  onMessageBlur={() => {
                    const current = qc.getQueryData<MarketingAutomation[]>(['marketing', 'automations'])
                    const row = current?.find(a => a.type === automation.type)
                    if (row) persist(automation.type, { messageTemplate: row.messageTemplate })
                  }}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
