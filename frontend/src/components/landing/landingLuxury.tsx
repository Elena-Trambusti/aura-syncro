import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { AURA_ICON_SIZE, type AuraIconSize } from '../../lib/auraIcon'

/** ID condiviso — un solo defs nel DOM (gradiente stroke affidabile cross-browser). */
export const LUX_GOLD_GRADIENT_ID = 'aura-lux-gold-stroke'

/** Shell sezione landing — bordi oro, glow, linee divisorie. */
export const LUXURY_SECTION_CLASS =
  'relative overflow-hidden border-y border-[#D4AF37]/10 py-24 sm:py-32'

export const LUXURY_CARD_CLASS =
  'group relative flex flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-gradient-to-b from-[#1a1408]/90 via-[#0f0c08]/95 to-[#080604] shadow-[0_24px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(232,200,114,0.1)] transition-all duration-500 hover:-translate-y-1 hover:border-[#D4AF37]/35 hover:shadow-[0_28px_56px_rgba(0,0,0,0.55),0_0_40px_rgba(212,175,55,0.08)]'

export const LUXURY_CARD_HOVER_LINE =
  'absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100'

export const LUXURY_CTA_CLASS =
  'group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_40px_rgba(212,175,55,0.35)] ring-1 ring-white/30 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_50px_rgba(212,175,55,0.5)]'

export function LandingSectionDecor() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(212,175,55,0.1),transparent_65%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(0,0,0,0.5),transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />
    </>
  )
}

export function LandingSectionShell({
  id,
  children,
  className,
  bordered = true,
}: {
  id?: string
  children: ReactNode
  className?: string
  bordered?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative overflow-hidden py-24 sm:py-32',
        bordered && 'border-y border-[#D4AF37]/10',
        className,
      )}
    >
      <LandingSectionDecor />
      {children}
    </section>
  )
}

export function LandingSectionHeader({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string
  title: string
  subtitle: string
  className?: string
}) {
  return (
    <div className={cn('relative z-10 mx-auto mb-16 max-w-7xl px-6 text-center lg:px-8', className)}>
      {eyebrow ? <p className="lux-eyebrow mb-4">{eyebrow}</p> : null}
      <h2 className="lux-heading font-display text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-relaxed text-[#F0E6D2] sm:text-lg">
        {subtitle}
      </p>
    </div>
  )
}

export function LuxuryCardHoverLine() {
  return <div className={LUXURY_CARD_HOVER_LINE} aria-hidden />
}

/** Defs gradiente oro — montare una volta per sezione (es. in LandingGallery). */
export function LuxuryGoldGradientDefs() {
  return (
    <svg
      aria-hidden
      width={0}
      height={0}
      className="pointer-events-none fixed"
      style={{ position: 'fixed', width: 0, height: 0 }}
    >
      <defs>
        <linearGradient
          id={LUX_GOLD_GRADIENT_ID}
          gradientUnits="userSpaceOnUse"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
        >
          <stop offset="0%" stopColor="#FFF9ED" />
          <stop offset="22%" stopColor="#F7E7CE" />
          <stop offset="50%" stopColor="#E8C872" />
          <stop offset="78%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9A7B28" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Icona Lucide con stroke oro a gradiente, glow e linea ultra-fine — stile gioiello. */
export function LuxuryGradientIcon({
  icon: Icon,
  size = 'xl',
  className,
}: {
  icon: LucideIcon
  size?: AuraIconSize
  className?: string
}) {
  const stroke = `url(#${LUX_GOLD_GRADIENT_ID})`

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible',
        AURA_ICON_SIZE[size],
        className,
      )}
    >
      <Icon
        className={cn(AURA_ICON_SIZE[size], 'absolute inset-0 m-auto opacity-30 blur-[1.5px]')}
        stroke="#E8C872"
        strokeWidth={1.5}
        aria-hidden
      />
      <Icon
        className={cn(
          AURA_ICON_SIZE[size],
          'relative z-10 shrink-0 overflow-visible',
          'drop-shadow-[0_0_10px_rgba(232,200,114,0.5)]',
          'transition-all duration-500',
          'group-hover:drop-shadow-[0_0_16px_rgba(247,231,206,0.8)]',
        )}
        stroke={stroke}
        color="#E8C872"
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      />
    </span>
  )
}

/** Medaglione oro — icona premium per card landing (doppio anello, glow, tick cardinali). */
export function LuxuryIconMedallion({
  icon,
  size = 'lg',
  className,
}: {
  icon: LucideIcon
  size?: 'md' | 'lg'
  className?: string
}) {
  const shell = size === 'lg' ? 'h-[5.5rem] w-[5.5rem]' : 'h-16 w-16'
  const inner = size === 'lg' ? 'h-[4.25rem] w-[4.25rem]' : 'h-12 w-12'
  const iconSize = size === 'lg' ? 'xl' : 'lg'

  return (
    <div className={cn('relative mx-auto flex shrink-0 items-center justify-center', shell, className)}>
      <div
        className="pointer-events-none absolute inset-0 rounded-full border border-[#D4AF37]/22 opacity-80 transition-all duration-500 group-hover:scale-[1.04] group-hover:border-[#D4AF37]/38 group-hover:opacity-100"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[5px] rounded-full border border-[#D4AF37]/10"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-gradient-to-b from-[#E8C872]/60 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-0 left-1/2 h-2.5 w-px -translate-x-1/2 bg-gradient-to-t from-[#E8C872]/60 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute left-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-gradient-to-r from-[#E8C872]/60 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-0 top-1/2 h-px w-2.5 -translate-y-1/2 bg-gradient-to-l from-[#E8C872]/60 to-transparent"
        aria-hidden
      />
      <div
        className={cn(
          'relative z-10 flex shrink-0 items-center justify-center overflow-visible rounded-full p-2',
          'border border-[#D4AF37]/38',
          'bg-[radial-gradient(circle_at_32%_26%,rgba(247,231,206,0.18)_0%,transparent_48%),radial-gradient(circle_at_68%_78%,rgba(212,175,55,0.12)_0%,transparent_42%),linear-gradient(165deg,rgba(22,17,10,0.98)_0%,rgba(4,4,4,1)_100%)]',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.4),0_0_36px_rgba(212,175,55,0.22)]',
          'transition-all duration-500 group-hover:border-[#F0E6D2]/35 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_48px_rgba(212,175,55,0.38)]',
          inner,
        )}
      >
        <LuxuryGradientIcon icon={icon} size={iconSize} />
      </div>
    </div>
  )
}
