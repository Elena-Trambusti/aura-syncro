import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AuraSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface AuraSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: AuraSelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
  'aria-label'?: string
}

export default function AuraSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  triggerClassName,
  disabled,
  'aria-label': ariaLabel,
}: AuraSelectProps) {
  const selected = options.find(o => o.value === value)

  return (
    <Select.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger
        className={cn('aura-select-trigger', triggerClassName, className)}
        aria-label={ariaLabel}
      >
        <Select.Value placeholder={placeholder}>
          {selected?.label}
        </Select.Value>
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="aura-select-content" position="popper" sideOffset={6}>
          <Select.Viewport className="aura-select-viewport">
            {options.map(opt => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="aura-select-item"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator className="aura-select-indicator">
                  <Check className="h-3.5 w-3.5 text-aura-gold" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
