import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { api } from '../lib/api'
import { getRoleLabel, getInitials, cn } from '../lib/utils'
import { useRole } from '../hooks/useRole'
import { type AppRole } from '../lib/rbac'
import { Plus, UserCog, Loader2, X, UserMinus, UserCheck, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import StaffShiftsTab from '../components/staff/StaffShiftsTab'
import ModalPortal from '../components/ModalPortal'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'

type StaffTab = 'team' | 'shifts'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  active: boolean
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-500/15 text-purple-300',
  MANAGER: 'bg-blue-500/15 text-blue-300',
  WAITER: 'bg-emerald-500/15 text-emerald-300',
  CHEF: 'bg-amber-500/15 text-amber-300',
  BARTENDER: 'bg-cyan-500/15 text-cyan-300',
  HOST: 'bg-pink-500/15 text-pink-300',
}

const MIN_PASSWORD_LENGTH = 6

function apiErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<{ error?: string }>
  return axiosErr.response?.data?.error ?? fallback
}

export default function StaffPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { assignableStaffRoles } = useRole()
  const [activeTab, setActiveTab] = useState<StaffTab>('team')
  const [showForm, setShowForm] = useState(false)
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER' as AppRole,
    phone: '',
  })

  const { data: staff = [], isLoading, isError } = useQuery<StaffMember[]>({
    queryKey: tq(tk, 'staff'),
    queryFn: () => api.get('/staff').then(r => r.data),
  })

  const assignableStaff = useMemo(
    () => staff.filter(m => m.role !== 'OWNER' && m.active !== false),
    [staff],
  )

  const openAddMemberForm = () => {
    setActiveTab('team')
    setShowForm(true)
  }

  const createStaff = useMutation({
    mutationFn: (data: typeof newStaff) =>
      api.post('/staff', {
        ...data,
        phone: data.phone.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') })
      setShowForm(false)
      setNewStaff({ name: '', email: '', password: '', role: 'WAITER', phone: '' })
      toast.success(t('staff.memberAdded'))
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('staff.memberAddError'))),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/staff/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') }),
    onError: (err) => toast.error(apiErrorMessage(err, t('staff.memberAddError'))),
  })

  const canSubmitMember =
    newStaff.name.trim().length >= 2
    && newStaff.email.trim().length > 0
    && newStaff.password.length >= MIN_PASSWORD_LENGTH

  return (
    <ExecutivePageShell className="mx-auto max-w-5xl space-y-6">
      <ExecutivePageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        actions={(
          <button
            type="button"
            onClick={openAddMemberForm}
            className="flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light"
          >
            <Plus className="h-4 w-4" />
            {t('staff.addMember')}
          </button>
        )}
      />

      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-navy-surface/40 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'team'
              ? 'bg-aura-gold/15 text-aura-gold shadow-sm'
              : 'text-fumo hover:text-pietra',
          )}
        >
          <UserCog className="h-4 w-4" />
          {t('staff.tabTeam')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'shifts'
              ? 'bg-aura-gold/15 text-aura-gold shadow-sm'
              : 'text-fumo hover:text-pietra',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t('staff.shifts')}
        </button>
      </div>

      {activeTab === 'shifts' ? (
        <StaffShiftsTab staff={staff} onAddMember={openAddMemberForm} />
      ) : (
        <>
          {assignableStaff.length === 0 && !isLoading && !isError && (
            <div className="rounded-xl border border-aura-gold/30 bg-aura-gold/10 p-4 text-sm">
              <p className="font-semibold text-pietra">{t('staff.teamOnlyOwnerTitle')}</p>
              <p className="mt-1 text-fumo">{t('staff.teamOnlyOwnerHint')}</p>
              <button
                type="button"
                onClick={openAddMemberForm}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-aura-gold px-4 py-2 text-xs font-semibold text-white hover:bg-aura-gold-light"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('staff.addFirstMember')}
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-navy-elevated shadow-sm">
            {isLoading ? (
              <PageSkeleton variant="table" count={6} className="p-4" />
            ) : isError ? (
              <div className="p-6">
                <QueryErrorBanner />
              </div>
            ) : staff.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title={t('staff.empty')}
                action={(
                  <button
                    type="button"
                    onClick={openAddMemberForm}
                    className="inline-flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light"
                  >
                    <Plus className="h-4 w-4" />
                    {t('staff.addFirstMember')}
                  </button>
                )}
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full max-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-navy-surface/50 text-left text-xs font-semibold uppercase tracking-wide text-fumo">
                      <th className="px-5 py-3">{t('staff.colName')}</th>
                      <th className="px-4 py-3">{t('staff.colEmail')}</th>
                      <th className="px-4 py-3">{t('staff.colRole')}</th>
                      <th className="px-4 py-3">{t('staff.colStatus')}</th>
                      <th className="px-5 py-3 text-right">{t('staff.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {staff.map(member => (
                      <tr key={member.id} className={cn(!member.active && 'opacity-60')}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-gold/10 text-xs font-bold text-aura-gold">
                              {getInitials(member.name)}
                            </div>
                            <span className="font-medium text-pietra">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-fumo">{member.email}</td>
                        <td className="px-4 py-4">
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', ROLE_COLORS[member.role] ?? 'bg-navy-surface text-fumo')}>
                            {getRoleLabel(member.role)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn('text-xs font-medium', member.active ? 'text-emerald-400' : 'text-fumo')}>
                            {member.active ? t('staff.active') : t('staff.inactive')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {member.role !== 'OWNER' && (
                            <button
                              type="button"
                              onClick={() => toggleActive.mutate({ id: member.id, active: !member.active })}
                              disabled={toggleActive.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-fumo hover:bg-white/[0.05]"
                            >
                              {member.active ? (
                                <><UserMinus className="h-3.5 w-3.5" />{t('staff.deactivate')}</>
                              ) : (
                                <><UserCheck className="h-3.5 w-3.5" />{t('staff.activate')}</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <ModalPortal onClose={() => !createStaff.isPending && setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-white/[0.08] bg-navy-elevated p-6 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-pietra">{t('staff.addMemberTitle')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-fumo hover:bg-white/[0.05]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formName')}
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  autoFocus
                />
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formEmail')}
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formPassword')}
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <span className="mt-1 block text-xs text-fumo">{t('staff.formPasswordHint', { min: MIN_PASSWORD_LENGTH })}</span>
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formRole')}
                <select
                  value={newStaff.role}
                  onChange={e => setNewStaff(s => ({ ...s, role: e.target.value as AppRole }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                >
                  {assignableStaffRoles.map(r => (
                    <option key={r} value={r}>{getRoleLabel(r)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formPhone')}
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={e => setNewStaff(s => ({ ...s, phone: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => createStaff.mutate(newStaff)}
                disabled={createStaff.isPending || !canSubmitMember}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('staff.addMember')}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </ExecutivePageShell>
  )
}
