import { describe, expect, it } from 'vitest'
import { parseMenuCsv } from '../../backend/src/lib/menuCsvImport'

describe('menuCsvImport — parseMenuCsv', () => {
  it('parsa header name,price,category e righe dati', () => {
    const csv = `name,price,category,description
Carbonara,14.50,Primi,Pasta classica
Tiramisù,6.00,Dolci,`

    const { rows, errors } = parseMenuCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: 'Carbonara', price: 14.5, category: 'Primi', description: 'Pasta classica' })
    expect(rows[1]).toMatchObject({ name: 'Tiramisù', price: 6, category: 'Dolci' })
  })

  it('ignora righe commento e segnala prezzo non valido', () => {
    const csv = `# menu demo
Pizza,abc,Pizze
Margherita,9.00,Pizze`

    const { rows, errors } = parseMenuCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Margherita')
    expect(errors.some(e => e.includes('prezzo non valido'))).toBe(true)
  })
})
