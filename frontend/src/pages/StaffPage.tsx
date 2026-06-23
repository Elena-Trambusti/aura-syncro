import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { getRoleLabel, getInitials, cn } from '../lib/utils'
import { useRole } from '../hooks/useRole'
import { type AppRole } from '../lib/rbac'
import { Plus, UserCog, Loader2, X, UserMinus, UserCheck, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import StaffShiftsTab from '../components/staff/StaffShiftsTab'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'

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
  OWNER: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  WAITER: 'bg-emerald-100 text-emerald-800',
  CHEF: 'bg-amber-100 text-amber-800',
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

  const createStaff = useMutation({
    mutationFn: (data: typeof newStaff) => api.post('/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') })
      setShowForm(false)
      setNewStaff({ name: '', email: '', password: '', role: 'WAITER', phone: '' })
      toast.success(t('staff.memberAdded'))
    },
    onError: () => toast.error(t('staff.memberAddError')),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/staff/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') }),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('staff.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('staff.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className={cn(
            'flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600',
            activeTab !== 'team' && 'hidden',
          )}
        >
          <Plus className="h-4 w-4" />
          {t('staff.addMember')}
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'team'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          <UserCog className="h-4 w-4" />
          {t('staff.tabTeam')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'shifts'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t('staff.shifts')}
        </button>
      </div>

      {activeTab === 'shifts' ? (
        <StaffShiftsTab onGoToTeam={() => setActiveTab('team')} />
      ) : (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <QueryErrorBanner />
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-500">
            <UserCog className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{t('staff.empty')}</p>
          </div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full max-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">{t('staff.colName')}</th>
                  <th className="px-4 py-3">{t('staff.colEmail')}</th>
                  <th className="px-4 py-3">{t('staff.colRole')}</th>
                  <th className="px-4 py-3">{t('staff.colStatus')}</th>
                  <th className="px-5 py-3 text-right">{t('staff.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(member => (
                  <tr key={member.id} className={cn(!member.active && 'opacity-60')}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-700">
                          {getInitials(member.name)}
                        </div>
                        <span className="font-medium text-slate-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{member.email}</td>
                    <td className="px-4 py-4">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', ROLE_COLORS[member.role] ?? 'bg-slate-100 text-slate-700')}>
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('text-xs font-medium', member.active ? 'text-emerald-600' : 'text-slate-400')}>
                        {member.active ? t('staff.active') : t('staff.inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {member.role !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: member.id, active: !member.active })}
                          disabled={toggleActive.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
      )}

      {showForm && activeTab === 'team' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t('staff.addMemberTitle')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-900">
                {t('staff.formName')}
                <input
                  type="text"
                  value={newStaff.name}
                  onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-900">
                {t('staff.formEmail')}
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-900">
                {t('staff.formPassword')}
                <input
                  type="password"
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-slate-900">
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
              <label className="block text-sm font-medium text-slate-900">
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
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => createStaff.mutate(newStaff)}
                disabled={createStaff.isPending || !newStaff.name || !newStaff.email || !newStaff.password}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {createStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('staff.addMember')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
