import { cn } from '../../lib/utils'

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', img: 'h-5 w-5' },
  md: { box: 'w-10 h-10 rounded-xl', img: 'h-6 w-6' },
  lg: { box: 'w-16 h-16 rounded-2xl', img: 'h-10 w-10' },
} as const

const ICON_SRC = '/brand/aura-syncro-icon.svg'

type BrandLogoSize = keyof typeof SIZES

interface BrandLogoProps {
  size?: BrandLogoSize
  className?: string
}

export default function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  const s = SIZES[size]
  return (
    <div className={cn('flex items-center justify-center shrink-0 overflow-hidden shadow-sm', s.box, className)}>
      <img src={ICON_SRC} alt="" className={cn(s.img, 'object-contain')} aria-hidden />
    </div>
  )
}
