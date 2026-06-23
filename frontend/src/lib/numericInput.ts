export type NumericField = number | ''

export function parseNumericInput(raw: string, mode: 'int' | 'float'): NumericField {
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  const n = mode === 'int' ? parseInt(trimmed, 10) : parseFloat(trimmed)
  return Number.isNaN(n) ? '' : n
}

export function numericToNumber(value: NumericField, fallback = 0): number {
  return value === '' ? fallback : value
}

export function numericFieldFrom(
  value: number | undefined | null,
  emptyDefault: NumericField = '',
): NumericField {
  if (value === undefined || value === null) return emptyDefault
  return value
}

export function numericInputProps(
  value: NumericField,
  onChange: (next: NumericField) => void,
  mode: 'int' | 'float' = 'float',
) {
  return {
    type: 'number' as const,
    value: value === '' ? '' : value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseNumericInput(e.target.value, mode))
    },
  }
}
