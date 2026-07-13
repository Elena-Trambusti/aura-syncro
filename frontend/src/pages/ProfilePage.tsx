import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { setSessionToken } from '../lib/sessionToken'
import { formatApiError } from '../lib/formatApiError'
import { toast } from '@/lib/toast'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import AuraButton from '../components/ui/AuraButton'

const MIN_PASSWORD_LENGTH = 8

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, refreshRestaurant } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error(t('profile.nameRequired'))
      return
    }
    if (!email.trim()) {
      toast.error(t('profile.emailRequired'))
      return
    }
    if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('profile.passwordTooShort', { min: MIN_PASSWORD_LENGTH }))
      return
    }
    if (newPassword && !currentPassword) {
      toast.error(t('profile.currentPasswordRequired'))
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, string> = { name: name.trim(), email: email.trim() }
      if (newPassword) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }
      const res = await api.patch('/auth/profile', payload)
      if (res.data.token) {
        setSessionToken(res.data.token)
      }
      await refreshRestaurant()
      setCurrentPassword('')
      setNewPassword('')
      toast.success(t('profile.saved'))
    } catch (err) {
      toast.error(formatApiError(t, err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ExecutivePageShell className="space-y-6 max-w-xl">
      <ExecutivePageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
      />

      <div className="premium-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-2 border-b border-white/[0.06]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-gold/10 text-aura-gold">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-pietra">{user?.name}</p>
            <p className="text-xs text-fumo">{t(`status.role.${user?.role}`, { defaultValue: user?.role })}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-fumo mb-1.5">{t('profile.name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="premium-input w-full"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-fumo mb-1.5">{t('profile.email')}</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="premium-input w-full"
            autoComplete="email"
          />
        </div>

        <div className="pt-2 border-t border-white/[0.06] space-y-4">
          <h3 className="text-sm font-semibold text-pietra">{t('profile.changePassword')}</h3>
          <div>
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('profile.currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="premium-input w-full"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('profile.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="premium-input w-full"
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-fumo">{t('profile.passwordHint', { min: MIN_PASSWORD_LENGTH })}</p>
          </div>
        </div>

        <AuraButton
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4" />
          {saving ? t('common.saving') : t('profile.save')}
        </AuraButton>
      </div>
    </ExecutivePageShell>
  )
}
