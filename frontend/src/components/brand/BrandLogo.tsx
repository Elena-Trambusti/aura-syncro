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
  priority?: boolean
  /** Gap ridotto e tagline nascosta su viewport stretti (header mobile) */
  compact?: boolean
}

export default function BrandLogo({
  size = 'md',
  className,
  showName = false,
  layout = 'icon',
  priority = false,
  compact = false,
}: BrandLogoProps) {
  const { t } = useTranslation()
  const s = SIZES[size]

  const iconBox = (
    <img
      src={ICON_SRC}
      alt=""
      className={cn(s.img, 'shrink-0 object-contain object-center')}
      width={size === 'sm' ? 32 : size === 'md' ? 44 : 56}
      height={size === 'sm' ? 32 : size === 'md' ? 44 : 56}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      aria-hidden
    />
  )

  if (!showName || layout === 'icon') {
    return <div className={cn('inline-flex', className)}>{iconBox}</div>
  }

  return (
    <div className={cn('flex items-center justify-center', compact ? 'gap-2' : 'gap-3', className)}>
      {iconBox}
      <div className="min-w-0 text-left">
        <p className={cn('font-display font-semibold tracking-tight text-pietra leading-tight whitespace-nowrap', s.text)}>
          {BRAND.name}
        </p>
        <p
          className={cn(
            'text-[8px] font-bold uppercase tracking-[0.22em] text-aura-gold/80 whitespace-nowrap',
            compact && 'hidden min-[420px]:block',
          )}
        >
          {t('brand.saasPlatform')}
        </p>
      </div>
    </div>
  )
}
