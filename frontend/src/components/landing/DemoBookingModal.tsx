import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { AuraDialog } from '@/components/ui/AuraDialog'

export default function DemoBookingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (isOpen) {
      const script = document.createElement('script')
      script.src = 'https://assets.calendly.com/assets/external/widget.js'
      script.async = true
      document.body.appendChild(script)
      return () => {
        document.body.removeChild(script)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const CALENDLY_URL = "https://calendly.com/aurasyncro/30min?hide_landing_page_details=1&hide_gdpr_banner=1&background_color=0A0A0A&text_color=F0E6D2&primary_color=C5A059"

  return (
    <AuraDialog
      onClose={onClose}
      hideClose
      a11yTitle={t('landing.demoModal.a11yTitle')}
      a11yDescription={t('landing.demoModal.a11yDescription')}
      className="max-w-4xl w-full p-0 overflow-hidden bg-neutral-950 border border-[#C5A059]/30 h-[80vh] max-h-[700px] flex flex-col"
    >
      <div className="relative flex-1 flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 text-neutral-400 hover:text-[#C5A059] transition-colors bg-black/60 rounded-full backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pt-6 pb-2 px-8 text-center bg-neutral-950 shrink-0">
          <h2 className="lux-heading font-display text-2xl font-medium tracking-tight text-[#C5A059]">
            {t('landing.demoModal.title')}
          </h2>
          <p className="text-sm font-light text-[#F0E6D2] mt-1">
            {t('landing.demoModal.subtitle')}
          </p>
        </div>

        <div className="flex-1 w-full bg-[#0A0A0A] overflow-hidden">
          <div 
            className="calendly-inline-widget w-full h-full" 
            data-url={CALENDLY_URL} 
            style={{ minWidth: '320px', height: '100%' }}
          />
        </div>
      </div>
    </AuraDialog>
  )
}
