import { cn } from '../../lib/utils'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', img: 'h-5 w-5', text: 'text-sm' },
  md: { box: 'h-11 w-11 rounded-xl', img: 'h-6 w-6', text: 'text-base' },
  lg: { box: 'h-14 w-14 rounded-2xl', img: 'h-8 w-8', text: 'text-lg' },
} as const

const ICON_SRC = '/brand/aura-syncro-icon.svg'

type BrandLogoSize = keyof typeof SIZES

interface BrandLogoProps {
  size?: BrandLogoSize
  className?: string
  showName?: boolean
  layout?: 'icon' | 'horizontal'
}

export default function BrandLogo({
  size = 'md',
  className,
  showName = false,
  layout = 'icon',
}: BrandLogoProps) {
  const { t } = useTranslation()
  const s = SIZES[size]

  const iconBox = (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden border border-aura-gold/30',
        'bg-gradient-to-br from-navy-elevated via-[#1e222c] to-navy-mid',
        s.box,
      )}
      style={{ boxShadow: 'var(--aura-signature-glow), inset 0 1px 0 rgba(255,255,255,0.07)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-aura-gold/10 via-transparent to-transparent" aria-hidden />
      <img
        src={ICON_SRC}
        alt=""
        className={cn(s.img, 'relative z-10 object-contain object-center')}
        aria-hidden
      />
    </div>
  )

  if (!showName || layout === 'icon') {
    return <div className={cn('inline-flex', className)}>{iconBox}</div>
  }

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {iconBox}
      <div className="min-w-0 text-center">
        <p className={cn('font-display font-semibold tracking-tight text-pietra leading-tight', s.text)}>
          {BRAND.name}
        </p>
        <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-aura-gold/80">
          {t('brand.saasPlatform')}
        </p>
      </div>
    </div>
  )
}
