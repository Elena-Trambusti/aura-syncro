import { cn } from '../../lib/utils'

export interface FilterPill {
  key: string
  label: string
  count?: number
}

interface FilterPillsProps {
  filters: FilterPill[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export default function FilterPills({ filters, active, onChange, className }: FilterPillsProps) {
  return (
    <div className={cn('aura-filter-row', className)}>
      {filters.map(f => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={cn(
            'aura-filter-pill',
            active === f.key && 'aura-filter-pill--active',
          )}
        >
          {f.label}
          {f.count !== undefined && (
            <span className={cn(
              'aura-filter-pill__count',
              active === f.key && 'aura-filter-pill__count--active',
            )}>
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
