import { cn } from '../../lib/utils'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'

const SIZES = {
  sm: { img: 'h-8 w-8', text: 'text-sm' },
  md: { img: 'h-11 w-11', text: 'text-base' },
  lg: { img: 'h-14 w-14', text: 'text-lg' },
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
    <img
      src={ICON_SRC}
      alt=""
      className={cn(s.img, 'shrink-0 object-contain object-center drop-shadow-md')}
      style={{ filter: 'drop-shadow(0 4px 12px rgba(212, 175, 55, 0.2))' }}
      aria-hidden
    />
  )

  if (!showName || layout === 'icon') {
    return <div className={cn('inline-flex', className)}>{iconBox}</div>
  }

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {iconBox}
      <div className="min-w-0 text-left">
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
