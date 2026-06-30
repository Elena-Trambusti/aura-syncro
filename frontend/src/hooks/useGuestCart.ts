import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMoney, lineGrossMoney } from '../lib/money'

export interface GuestModifierGroup {
  id: string
  name: string
  isRequired: boolean
  minOptions: number
  maxOptions: number
  multiSelect: boolean
  options: Array<{ id: string; name: string; price: number }>
}

export interface GuestCartItem {
  cartLineId: string
  menuItemId: string
  name: string
  /** Prezzo unitario lordo (base + modificatori) */
  price: number
  quantity: number
  notes?: string
  modifierIds: string[]
  modifierLabels: string[]
}

export function buildGuestCartLineId(menuItemId: string, modifierIds: string[]): string {
  const sorted = [...modifierIds].sort()
  return sorted.length ? `${menuItemId}:${sorted.join(',')}` : menuItemId
}

function storageKey(slug: string) {
  return `aura-guest-cart:${slug}`
}

function readStored(slug: string): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    if (!raw) return []
    const parsed = JSON.parse(raw) as GuestCartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(item => ({
      ...item,
      cartLineId: item.cartLineId ?? buildGuestCartLineId(item.menuItemId, item.modifierIds ?? []),
      modifierIds: item.modifierIds ?? [],
      modifierLabels: item.modifierLabels ?? [],
    }))
  } catch {
    return []
  }
}

export function useGuestCart(slug: string | undefined) {
  const [items, setItems] = useState<GuestCartItem[]>(() => (slug ? readStored(slug) : []))

  useEffect(() => {
    if (!slug) {
      setItems([])
      return
    }
    setItems(readStored(slug))
  }, [slug])

  useEffect(() => {
    if (!slug) return
    if (items.length === 0) {
      localStorage.removeItem(storageKey(slug))
    } else {
      localStorage.setItem(storageKey(slug), JSON.stringify(items))
    }
  }, [slug, items])

  const addItem = useCallback((item: Omit<GuestCartItem, 'quantity' | 'cartLineId'> & { quantity?: number }) => {
    const cartLineId = buildGuestCartLineId(item.menuItemId, item.modifierIds)
    const quantity = item.quantity ?? 1
    setItems(prev => {
      const existing = prev.find(i => i.cartLineId === cartLineId)
      if (existing) {
        return prev.map(i =>
          i.cartLineId === cartLineId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        )
      }
      return [...prev, { ...item, cartLineId, quantity }]
    })
  }, [])

  const setQuantity = useCallback((cartLineId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) return prev.filter(i => i.cartLineId !== cartLineId)
      return prev.map(i => (i.cartLineId === cartLineId ? { ...i, quantity } : i))
    })
  }, [])

  const removeItem = useCallback((cartLineId: string) => {
    setItems(prev => prev.filter(i => i.cartLineId !== cartLineId))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  )

  const subtotal = useMemo(
    () => items.reduce((sum, i) => addMoney(sum, lineGrossMoney(i.quantity, i.price)), 0),
    [items],
  )

  return {
    items,
    itemCount,
    subtotal,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  }
}
