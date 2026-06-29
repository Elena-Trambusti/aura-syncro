export type ModifierOptionRow = {
  id: string
  name: string
  price: number
}

export type ModifierGroupRow = {
  id: string
  name: string
  isRequired: boolean
  minOptions: number
  maxOptions: number | null
  multiSelect: boolean
  options: ModifierOptionRow[]
}

export type MenuItemWithModifiers = {
  price: number
  taxRate?: number | null
  modifierGroups: ModifierGroupRow[]
}

export type ResolvedModifierOption = {
  optionId: string
  name: string
  price: number
}

export type ResolvedMenuLine = {
  unitPrice: number
  selectedOptions: ResolvedModifierOption[]
  menuTaxRate: number | null
}

export class ModifierValidationError extends Error {
  constructor(
    message: string,
    readonly code: string = 'INVALID_MODIFIER',
  ) {
    super(message)
    this.name = 'ModifierValidationError'
  }
}

/** Valida selezione modificatori e calcola prezzo riga (allineato al POS cameriere). */
export function resolveMenuItemLine(
  menuItem: MenuItemWithModifiers,
  modifierIds?: string[],
): ResolvedMenuLine {
  const selectedIds = [...new Set(modifierIds ?? [])]
  let unitPrice = menuItem.price
  const selectedOptions: ResolvedModifierOption[] = []

  const allOptions = menuItem.modifierGroups.flatMap(g => g.options)
  const optionsByGroup = new Map(menuItem.modifierGroups.map(g => [g.id, g]))

  for (const group of menuItem.modifierGroups) {
    const selectedInGroup = selectedIds.filter(id =>
      group.options.some(o => o.id === id),
    )
    const min = group.isRequired ? Math.max(1, group.minOptions) : group.minOptions
    if (selectedInGroup.length < min) {
      throw new ModifierValidationError(
        `Seleziona almeno ${min} opzioni per ${group.name}`,
        'MODIFIER_MIN_NOT_MET',
      )
    }
    const max = group.maxOptions || (group.multiSelect ? 99 : 1)
    if (selectedInGroup.length > max) {
      throw new ModifierValidationError(
        `Troppe opzioni per ${group.name}`,
        'MODIFIER_MAX_EXCEEDED',
      )
    }
    if (!group.multiSelect && selectedInGroup.length > 1) {
      throw new ModifierValidationError(
        `Scegli una sola opzione per ${group.name}`,
        'MODIFIER_SINGLE_ONLY',
      )
    }
    void optionsByGroup
  }

  for (const optId of selectedIds) {
    const opt = allOptions.find(o => o.id === optId)
    if (!opt) {
      throw new ModifierValidationError('Modificatore non valido', 'INVALID_MODIFIER')
    }
    unitPrice += opt.price
    selectedOptions.push({ optionId: opt.id, name: opt.name, price: opt.price })
  }

  return {
    unitPrice,
    selectedOptions,
    menuTaxRate: menuItem.taxRate ?? null,
  }
}
