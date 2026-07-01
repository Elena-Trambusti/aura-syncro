import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

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
