import { useCallback, useEffect, useMemo, useState } from 'react'

export interface GuestCartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  notes?: string
}

function storageKey(slug: string) {
  return `aura-guest-cart:${slug}`
}

function readStored(slug: string): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(slug))
    if (!raw) return []
    const parsed = JSON.parse(raw) as GuestCartItem[]
    return Array.isArray(parsed) ? parsed : []
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

  const addItem = useCallback((item: Omit<GuestCartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItemId === item.menuItemId)
      if (existing) {
        return prev.map(i =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        )
      }
      return [...prev, { ...item, quantity }]
    })
  }, [])

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setItems(prev => {
      if (quantity <= 0) return prev.filter(i => i.menuItemId !== menuItemId)
      return prev.map(i => (i.menuItemId === menuItemId ? { ...i, quantity } : i))
    })
  }, [])

  const removeItem = useCallback((menuItemId: string) => {
    setItems(prev => prev.filter(i => i.menuItemId !== menuItemId))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  )

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  )

  const getQuantity = useCallback(
    (menuItemId: string) => items.find(i => i.menuItemId === menuItemId)?.quantity ?? 0,
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
    getQuantity,
  }
}
