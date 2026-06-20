import { Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import { BRAND_LOGO_GRADIENT } from '../../lib/brand'

const SIZES = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5' },
  lg: { box: 'w-16 h-16 rounded-2xl', icon: 'w-9 h-9' },
} as const

type BrandLogoSize = keyof typeof SIZES

interface BrandLogoProps {
  size?: BrandLogoSize
  className?: string
}

export default function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  const s = SIZES[size]
  return (
    <div
      className={cn('flex items-center justify-center shrink-0 shadow-sm', s.box, className)}
      style={{ background: BRAND_LOGO_GRADIENT }}
      aria-hidden
    >
      <Zap className={cn(s.icon, 'text-slate-900 fill-slate-900')} />
    </div>
  )
}
