import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { useAuth } from '../../contexts/AuthContext'
import { resolveDemoMarket } from '../../lib/demoAccounts'
import { markDemoSession } from '../../lib/demoSession'
import { toast } from '@/lib/toast'

type LiveDemoButtonProps = {
  className?: string
}

export default function LiveDemoButton({ className = 'lux-hero-cta lux-hero-cta--live group' }: LiveDemoButtonProps) {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)

  const handleDemoLogin = async () => {
    try {
      setIsLoading(true)
      const demo = resolveDemoMarket(location.pathname, i18n.language)
      await login(demo.email, demo.password, demo.slug)
      markDemoSession()
      navigate('/tavoli')
    } catch (error) {
      toast.error(t('landing.hero.demoError'))
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDemoLogin}
      disabled={isLoading}
      className={className}
    >
      {isLoading && <AuraIcon icon={Loader2} size="md" className="animate-spin" />}
      {t('landing.hero.ctaDemo')}
    </button>
  )
}
