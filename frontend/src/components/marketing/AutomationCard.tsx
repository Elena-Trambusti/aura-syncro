import { cn } from '../../lib/utils'

interface AutomationToggleProps {
  active: boolean
  disabled?: boolean
  onChange: (active: boolean) => void
  label: string
}

export function AutomationToggle({ active, disabled, onChange, label }: AutomationToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:ring-offset-2',
        active ? 'bg-amber-500' : 'bg-slate-200',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-1',
          active ? 'translate-x-6 ml-0.5' : 'translate-x-1',
        )}
      />
    </button>
  )
}

interface AutomationCardProps {
  title: string
  description: string
  icon: React.ReactNode
  active: boolean
  saving?: boolean
  messageTemplate: string
  onToggle: (active: boolean) => void
  onMessageChange: (message: string) => void
  onMessageBlur?: () => void
  templateLabel: string
}

export default function AutomationCard({
  title,
  description,
  icon,
  active,
  saving,
  messageTemplate,
  onToggle,
  onMessageChange,
  onMessageBlur,
  templateLabel,
}: AutomationCardProps) {
  return (
    <article
      className={cn(
        'rounded-xl border bg-white p-5 shadow-sm transition-shadow',
        active ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              active ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500',
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <AutomationToggle
          active={active}
          disabled={saving}
          onChange={onToggle}
          label={title}
        />
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">{templateLabel}</label>
        <textarea
          value={messageTemplate}
          onChange={e => onMessageChange(e.target.value)}
          onBlur={() => onMessageBlur?.()}
          rows={3}
          disabled={saving}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none disabled:opacity-60"
        />
      </div>
    </article>
  )
}
