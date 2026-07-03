import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { resolveToastApiError } from '../lib/formatApiError'
import { getRoleLabel, getInitials, cn } from '../lib/utils'
import { useRole } from '../hooks/useRole'
import { type AppRole } from '../lib/rbac'
import { Plus, UserCog, Loader2, X, UserMinus, UserCheck, CalendarDays, Pencil } from 'lucide-react'
import { toast } from '@/lib/toast'
import StaffShiftsTab from '../components/staff/StaffShiftsTab'
import GlassModal from '../components/ui/GlassModal'
import AuraSelect from '../components/ui/AuraSelect'
import { AuraTabs, AuraTabsList, AuraTabsTrigger } from '../components/ui/AuraTabs'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'

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

const MIN_PASSWORD_LENGTH = 8

export default function StaffPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { assignableStaffRoles } = useRole()
  const [activeTab, setActiveTab] = useState<StaffTab>('team')
  const [showForm, setShowForm] = useState(false)
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null)
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER' as AppRole,
    phone: '',
  })

  const { data: staffData, isLoading, isError } = useQuery<StaffMember[]>({
    queryKey: tq(tk, 'staff'),
    queryFn: () => api.get<StaffMember[]>('/staff').then(r => r.data),
  })
  const showStaffSkeleton = useShowQuerySkeleton(isLoading, staffData !== undefined)
  const staff = staffData ?? []

  const assignableStaff = useMemo(
    () => staff.filter(m => m.role !== 'OWNER' && m.active !== false),
    [staff],
  )

  const openAddMemberForm = () => {
    setNewStaff({ name: '', email: '', password: '', role: 'WAITER', phone: '' })
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
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'staff.memberAddError')),
  })

  const updateStaff = useMutation({
    mutationFn: (data: { id: string; payload: Record<string, unknown> }) =>
      api.put(`/staff/${data.id}`, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') })
      setEditingMember(null)
      toast.success(t('staff.memberUpdated'))
    },
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'staff.memberAddError')),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.put(`/staff/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tq(tk, 'staff') }),
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'staff.memberAddError')),
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

      <AuraTabs value={activeTab} onValueChange={v => setActiveTab(v as StaffTab)}>
        <AuraTabsList className="w-full sm:w-auto">
          <AuraTabsTrigger value="team">
            <UserCog className="h-4 w-4" />
            {t('staff.tabTeam')}
          </AuraTabsTrigger>
          <AuraTabsTrigger value="shifts">
            <CalendarDays className="h-4 w-4" />
            {t('staff.shifts')}
          </AuraTabsTrigger>
        </AuraTabsList>
      </AuraTabs>

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
            {showStaffSkeleton ? (
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
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingMember(member)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 px-3 py-1.5 text-xs font-medium text-fumo hover:text-aura-gold hover:border-aura-gold/30 hover:bg-aura-gold/10 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t('staff.editMember')}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive.mutate({ id: member.id, active: !member.active })}
                                disabled={toggleActive.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/5 px-3 py-1.5 text-xs font-medium text-fumo hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                              >
                                {member.active ? (
                                  <><UserMinus className="h-3.5 w-3.5" />{t('staff.deactivate')}</>
                                ) : (
                                  <><UserCheck className="h-3.5 w-3.5" />{t('staff.activate')}</>
                                )}
                              </button>
                            </div>
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
        <GlassModal onClose={() => !createStaff.isPending && setShowForm(false)} maxWidth="md">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-pietra">{t('staff.addMemberTitle')}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-fumo hover:text-pietra hover:bg-white/5 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
            <form
              autoComplete="off"
              onSubmit={e => {
                e.preventDefault()
                if (canSubmitMember && !createStaff.isPending) createStaff.mutate(newStaff)
              }}
              className="space-y-4"
            >
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formName')}
                <input
                  type="text"
                  name="staff-member-name"
                  value={newStaff.name}
                  onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formEmail')}
                <input
                  type="email"
                  name="staff-member-email"
                  value={newStaff.email}
                  onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  autoComplete="off"
                  inputMode="email"
                  placeholder="nome@ristorante.it"
                />
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formPassword')}
                <input
                  type="password"
                  name="staff-member-password"
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  placeholder="••••••••"
                />
                <span className="mt-1 block text-xs text-fumo">{t('staff.formPasswordHint', { min: MIN_PASSWORD_LENGTH })}</span>
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formRole')}
                <div className="mt-1">
                  <AuraSelect
                    value={newStaff.role}
                    onValueChange={v => setNewStaff(s => ({ ...s, role: v as AppRole }))}
                    options={assignableStaffRoles.map(r => ({ value: r, label: getRoleLabel(r) }))}
                  />
                </div>
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formPhone')}
                <input
                  type="tel"
                  name="staff-member-phone"
                  value={newStaff.phone}
                  onChange={e => setNewStaff(s => ({ ...s, phone: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  autoComplete="off"
                />
              </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createStaff.isPending || !canSubmitMember}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('staff.addMember')}
              </button>
            </div>
            </form>
        </GlassModal>
      )}
      {editingMember && (
        <GlassModal onClose={() => !updateStaff.isPending && setEditingMember(null)} maxWidth="md">
          <div
            className="w-full"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-pietra">{t('staff.editMemberTitle')}</h3>
              <button type="button" onClick={() => setEditingMember(null)} className="rounded-lg p-1 text-fumo hover:text-pietra hover:bg-white/5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <EditMemberForm
              member={editingMember}
              assignableRoles={assignableStaffRoles}
              isPending={updateStaff.isPending}
              onSave={(payload) => updateStaff.mutate({ id: editingMember.id, payload })}
              onCancel={() => setEditingMember(null)}
            />
          </div>
        </GlassModal>
      )}
    </ExecutivePageShell>
  )
}

function EditMemberForm({
  member,
  assignableRoles,
  isPending,
  onSave,
  onCancel,
}: {
  member: StaffMember
  assignableRoles: AppRole[]
  isPending: boolean
  onSave: (payload: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    role: member.role as AppRole,
    phone: member.phone ?? '',
    password: '',
  })

  return (
    <>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-pietra">
          {t('staff.formName')}
          <input type="text" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} className="saas-input mt-1 w-full py-2.5 text-sm" />
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('staff.formEmail')}
          <input type="email" value={form.email} onChange={e => setForm(s => ({ ...s, email: e.target.value }))} className="saas-input mt-1 w-full py-2.5 text-sm" />
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('staff.formPasswordOptional')}
          <input type="password" value={form.password} onChange={e => setForm(s => ({ ...s, password: e.target.value }))} className="saas-input mt-1 w-full py-2.5 text-sm" minLength={8} />
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('staff.formRole')}
          <select value={form.role} onChange={e => setForm(s => ({ ...s, role: e.target.value as AppRole }))} className="saas-input mt-1 w-full py-2.5 text-sm">
            {assignableRoles.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('staff.formPhone')}
          <input type="tel" value={form.phone} onChange={e => setForm(s => ({ ...s, phone: e.target.value }))} className="saas-input mt-1 w-full py-2.5 text-sm" />
        </label>
      </div>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo">{t('common.cancel')}</button>
        <button
          type="button"
          disabled={isPending || form.name.trim().length < 2}
          onClick={() => onSave({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            phone: form.phone.trim() || null,
            ...(form.password.length >= 8 ? { password: form.password } : {}),
          })}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('staff.saveChanges')}
        </button>
      </div>
    </>
  )
}
