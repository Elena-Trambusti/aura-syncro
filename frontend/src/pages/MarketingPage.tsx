import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { ui } from '../lib/ui'
import AutomationCard from '../components/marketing/AutomationCard'
import ModalPortal from '../components/ModalPortal'
import { Cake, RefreshCw, Crown, Plus, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../lib/utils'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'

type AutomationType = 'BIRTHDAY' | 'WIN_BACK' | 'VIP_THANKS'
type MarketingTab = 'automations' | 'campaigns'

interface MarketingAutomation {
  id: string
  type: AutomationType
  isActive: boolean
  messageTemplate: string
}

interface Campaign {
  id: string
  name: string
  type: string
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED'
  subject?: string | null
  message: string
  sentAt?: string | null
  recipientCount: number
  createdAt: string
}

const AUTOMATION_META: Record<
  AutomationType,
  { icon: typeof Cake; titleKey: string; descKey: string }
> = {
  BIRTHDAY: { icon: Cake, titleKey: 'marketing.automations.birthday.title', descKey: 'marketing.automations.birthday.description' },
  WIN_BACK: { icon: RefreshCw, titleKey: 'marketing.automations.winBack.title', descKey: 'marketing.automations.winBack.description' },
  VIP_THANKS: { icon: Crown, titleKey: 'marketing.automations.vipThanks.title', descKey: 'marketing.automations.vipThanks.description' },
}

const CAMPAIGN_STATUS_CLASS: Record<Campaign['status'], string> = {
  DRAFT: 'bg-navy-surface text-fumo',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  SENT: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-400',
}

type CampaignSegment = 'all' | 'inactive60' | 'inactive90' | 'topSpender' | 'frequent' | 'newCustomers' | 'vip' | 'birthdayMonth'

const SEGMENT_KEYS: CampaignSegment[] = ['all', 'inactive60', 'inactive90', 'topSpender', 'frequent', 'newCustomers', 'vip', 'birthdayMonth']

function CampaignFormModal({
  onSave,
  onCancel,
}: {
  onSave: (data: { name: string; subject: string; message: string; targetFilter: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', subject: '', message: '' })
  const [segment, setSegment] = useState<CampaignSegment>('all')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const loadPreview = async (seg: CampaignSegment) => {
    setPreviewLoading(true)
    try {
      const filter = seg === 'all' ? null : JSON.stringify({ segment: seg })
      const r = await api.post<{ count: number }>('/marketing/preview', { targetFilter: filter })
      setPreviewCount(r.data.count)
    } catch {
      setPreviewCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSegmentChange = (seg: CampaignSegment) => {
    setSegment(seg)
    void loadPreview(seg)
  }

  return (
    <ModalPortal onClose={onCancel}>
      <div className={ui.modal} onClick={e => e.stopPropagation()}>
        <h3 className={ui.modalTitle}>{t('marketing.newCampaign')}</h3>
        <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('common.name')} *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>{t('marketing.campaignSegment', { defaultValue: 'Segmento destinatari' })}</label>
            <select
              value={segment}
              onChange={e => handleSegmentChange(e.target.value as CampaignSegment)}
              className={ui.select}
            >
              {SEGMENT_KEYS.map(key => (
                <option key={key} value={key}>{t(`marketing.segments.${key}`)}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-fumo">{t(`marketing.segments.${segment}Hint`, { defaultValue: '' })}</p>
            {(previewCount !== null || previewLoading) && (
              <p className="mt-1 text-xs font-medium text-aura-gold">
                {previewLoading
                  ? t('common.loading')
                  : t('marketing.segmentPreview', { count: previewCount ?? 0, defaultValue: '{{count}} destinatari con email' })}
              </p>
            )}
          </div>
          <div>
            <label className={ui.label}>{t('marketing.campaignSubject')}</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>{t('marketing.campaignMessage')} *</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className={ui.textarea}
              rows={5}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onCancel} className={`flex-1 py-2.5 ${ui.chipInactive} rounded-xl text-sm font-medium`}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!form.name.trim() || !form.message.trim()}
            onClick={() => onSave({
              ...form,
              targetFilter: segment === 'all' ? '' : JSON.stringify({ segment }),
            })}
            className={`flex-1 py-2.5 ${ui.btnPrimary} text-sm disabled:opacity-50`}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </ModalPortal>
  )
}

export default function MarketingPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const tk = useTenantQueryKey()
  const [activeTab, setActiveTab] = useState<MarketingTab>('automations')
  const [showCampaignForm, setShowCampaignForm] = useState(false)

  const { data: automations = [], isLoading, isError: automationsError } = useQuery<MarketingAutomation[]>({
    queryKey: tq(tk, 'marketing', 'automations'),
    queryFn: () => api.get('/marketing/automations').then(r => r.data),
  })

  const { data: campaigns = [], isLoading: campaignsLoading, isError: campaignsError } = useQuery<Campaign[]>({
    queryKey: tq(tk, 'marketing', 'campaigns'),
    queryFn: () => api.get('/marketing').then(r => r.data),
    enabled: activeTab === 'campaigns',
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

  const createCampaign = useMutation({
    mutationFn: (data: { name: string; subject: string; message: string; targetFilter?: string }) =>
      api.post('/marketing', { ...data, type: 'EMAIL', ...(data.targetFilter ? { targetFilter: data.targetFilter } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'marketing', 'campaigns') })
      setShowCampaignForm(false)
      toast.success(t('marketing.campaignCreated'))
    },
    onError: () => toast.error(t('marketing.createError')),
  })

  const sendCampaign = useMutation({
    mutationFn: (id: string) => api.post(`/marketing/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'marketing', 'campaigns') })
      toast.success(t('marketing.campaignSent'))
    },
    onError: () => toast.error(t('marketing.sendError')),
  })

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tq(tk, 'marketing', 'campaigns') })
      toast.success(t('marketing.deleted'))
    },
  })

  const ordered = useMemo(() => {
    const order: AutomationType[] = ['BIRTHDAY', 'WIN_BACK', 'VIP_THANKS']
    return order
      .map(type => automations.find(a => a.type === type))
      .filter(Boolean) as MarketingAutomation[]
  }, [automations])

  const updateLocal = (type: AutomationType, patch: Partial<MarketingAutomation>) => {
    qc.setQueryData<MarketingAutomation[]>(tq(tk, 'marketing', 'automations'), prev =>
      (prev ?? []).map(a => (a.type === type ? { ...a, ...patch } : a)),
    )
  }

  const persist = (type: AutomationType, patch: { isActive?: boolean; messageTemplate?: string }) => {
    saveAutomation.mutate({ type, ...patch })
  }

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('marketing.title')}
        subtitle={t('marketing.subtitle')}
      />

      <div className="flex gap-2 border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => setActiveTab('automations')}
          className={cn(
            'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'automations'
              ? 'border-amber-500 text-aura-gold'
              : 'border-transparent text-fumo hover:text-pietra',
          )}
        >
          {t('marketing.tabAutomations')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={cn(
            'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'campaigns'
              ? 'border-amber-500 text-aura-gold'
              : 'border-transparent text-fumo hover:text-pietra',
          )}
        >
          {t('marketing.tabCampaigns')}
        </button>
      </div>

      {activeTab === 'automations' ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-pietra">{t('marketing.automations.sectionTitle')}</h2>
            <p className="text-sm text-fumo mt-1">{t('marketing.automations.sectionSubtitle')}</p>
          </div>

          {isLoading ? (
            <PageSkeleton variant="cards" count={3} />
          ) : automationsError ? (
            <QueryErrorBanner />
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
                      const current = qc.getQueryData<MarketingAutomation[]>(tq(tk, 'marketing', 'automations'))
                      const row = current?.find(a => a.type === automation.type)
                      if (row) persist(automation.type, { messageTemplate: row.messageTemplate })
                    }}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-pietra">{t('marketing.campaignsSectionTitle')}</h2>
              <p className="text-sm text-fumo mt-1">{t('marketing.campaignsSectionSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCampaignForm(true)}
              className="flex items-center justify-center gap-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t('marketing.newCampaign')}
            </button>
          </div>

          {campaignsLoading ? (
            <PageSkeleton variant="list" count={4} />
          ) : campaignsError ? (
            <QueryErrorBanner />
          ) : campaigns.length === 0 ? (
            <EmptyState icon={Send} title={t('common.noData')} />
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <div key={campaign.id} className={`${ui.cardSm} p-4 flex flex-col sm:flex-row sm:items-center gap-4`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-pietra">{campaign.name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', CAMPAIGN_STATUS_CLASS[campaign.status])}>
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.subject && (
                      <p className="text-sm text-fumo mt-1 truncate">{campaign.subject}</p>
                    )}
                    <p className="text-xs text-fumo mt-1">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                      {campaign.status === 'SENT' && ` · ${campaign.recipientCount} ${t('common.pieces')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {campaign.status !== 'SENT' && (
                      <button
                        type="button"
                        onClick={() => sendCampaign.mutate(campaign.id)}
                        disabled={sendCampaign.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        {t('marketing.sendCampaign')}
                      </button>
                    )}
                    {campaign.status !== 'SENT' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('marketing.confirmDeleteCampaign'))) deleteCampaign.mutate(campaign.id)
                        }}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-fumo hover:text-red-400"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showCampaignForm && (
        <CampaignFormModal
          onSave={data => createCampaign.mutate(data)}
          onCancel={() => setShowCampaignForm(false)}
        />
      )}
    </ExecutivePageShell>
  )
}
