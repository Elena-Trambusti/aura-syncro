import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { AuraDialog } from '@/components/ui/AuraDialog'

const CALENDLY_EMBED_URL =
  'https://calendly.com/aurasyncro/30min?hide_landing_page_details=1&hide_gdpr_banner=1&hide_event_type_details=1&background_color=0A0A0A&text_color=F0E6D2&primary_color=C5A059'

export default function DemoBookingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (isOpen) setIsLoaded(false)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AuraDialog
      onClose={onClose}
      hideClose
      maxWidth="4xl"
      a11yTitle={t('landing.demoModal.a11yTitle')}
      a11yDescription={t('landing.demoModal.a11yDescription')}
      className="landing-demo-modal flex h-[80vh] max-h-[700px] w-full max-w-4xl flex-col overflow-hidden !border !border-[#C5A059]/30 !bg-neutral-950 p-0 !shadow-[0_24px_64px_rgba(0,0,0,0.75),0_0_48px_rgba(212,175,55,0.08)] !backdrop-blur-none sm:rounded-2xl"
    >
      <div className="relative flex flex-1 flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-full bg-black/60 p-2 text-neutral-400 backdrop-blur-md transition-colors hover:text-[#C5A059]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="shrink-0 border-b border-[#D4AF37]/10 bg-neutral-950 px-8 pb-3 pt-6 text-center">
          <h2 className="lux-heading font-display text-2xl font-medium tracking-tight text-[#C5A059]">
            {t('landing.demoModal.title')}
          </h2>
          <p className="mt-1 text-sm font-light text-[#F0E6D2]">
            {t('landing.demoModal.subtitle')}
          </p>
        </div>

        <div className="landing-calendly-shell relative min-h-0 flex-1 bg-[#0A0A0A]">
          {!isLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0A0A]">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#C5A059]" />
              <p className="text-sm font-medium uppercase tracking-widest text-[#F0E6D2]">
                {t('landing.demoModal.loading')}
              </p>
            </div>
          )}
          <iframe
            key={isOpen ? 'open' : 'closed'}
            src={CALENDLY_EMBED_URL}
            title={t('landing.demoModal.a11yTitle')}
            className={`h-full w-full border-0 bg-[#0A0A0A] transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setIsLoaded(true)}
          />
        </div>
      </div>
    </AuraDialog>
  )
}
