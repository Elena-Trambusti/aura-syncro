import type { LucideIcon, LucideProps } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  AURA_ICON_SIZE,
  AURA_ICON_STROKE,
  type AuraIconSize,
  type AuraIconWeight,
} from '../../lib/auraIcon'

export type { AuraIconSize, AuraIconWeight }

type AuraIconProps = Omit<LucideProps, 'ref'> & {
  icon: LucideIcon
  size?: AuraIconSize
  weight?: AuraIconWeight
  /** Voce nav / link attivo → stroke 1.5 */
  active?: boolean
}

/** Icona Lucide uniformata — fine-line luxury in tutta l'app. */
export default function AuraIcon({
  icon: Icon,
  size = 'md',
  weight = 'fine',
  active = false,
  className,
  strokeWidth,
  ...props
}: AuraIconProps) {
  const resolvedWeight: AuraIconWeight = active ? 'active' : weight

  return (
    <Icon
      className={cn(
        AURA_ICON_SIZE[size],
        weight === 'display' && 'aura-icon--display',
        className,
      )}
      strokeWidth={strokeWidth ?? AURA_ICON_STROKE[resolvedWeight]}
      aria-hidden={props['aria-hidden'] ?? true}
      {...props}
    />
  )
}
