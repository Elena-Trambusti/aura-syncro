import type { CountryCode } from '@prisma/client'

const IT_VAT = /^IT?\s*(\d{11})$/i
const ES_NIF = /^(\d{8})([A-Z])$/i
const ES_NIE = /^[XYZ](\d{7})([A-Z])$/i
const ES_CIF = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/i

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

function validateItalianVatDigits(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let n = Number(digits[i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(digits[10])
}

function validateSpanishNifLetter(digits: string, letter: string): boolean {
  const idx = Number(digits) % 23
  return NIF_LETTERS[idx] === letter.toUpperCase()
}

function validateSpanishCif(cif: string): boolean {
  const match = cif.match(ES_CIF)
  if (!match) return false
  const [, type, digits, control] = match
  let sumEven = 0
  let sumOdd = 0
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i])
    if (i % 2 === 0) {
      const doubled = n * 2
      sumOdd += doubled > 9 ? doubled - 9 : doubled
    } else {
      sumEven += n
    }
  }
  const total = sumEven + sumOdd
  const controlDigit = (10 - (total % 10)) % 10
  const controlLetter = 'JABCDEFGHI'[controlDigit]
  if (/[ABEH]/.test(type)) return control.toUpperCase() === String(controlDigit)
  if (/[KPQS]/.test(type)) return control.toUpperCase() === controlLetter
  return control.toUpperCase() === String(controlDigit) || control.toUpperCase() === controlLetter
}

export function normalizeTaxId(raw: string): string {
  return raw.trim().replace(/[\s.-]/g, '').toUpperCase()
}

export type TaxIdValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; code: 'INVALID_FORMAT' | 'INVALID_CHECKSUM' | 'UNSUPPORTED_COUNTRY' }

/**
 * Valida P.IVA (IT) o NIF/CIF/NIE (ES) in base al countryCode del tenant.
 */
export function validateTaxId(raw: string, countryCode: CountryCode): TaxIdValidationResult {
  const normalized = normalizeTaxId(raw)
  if (!normalized) {
    return { valid: false, code: 'INVALID_FORMAT' }
  }

  if (countryCode === 'IT') {
    const withPrefix = normalized.startsWith('IT') ? normalized : `IT${normalized}`
    const match = withPrefix.match(IT_VAT)
    if (!match) return { valid: false, code: 'INVALID_FORMAT' }
    const digits = match[1]
    if (!validateItalianVatDigits(digits)) return { valid: false, code: 'INVALID_CHECKSUM' }
    return { valid: true, normalized: `IT${digits}` }
  }

  if (countryCode === 'ES') {
    const nif = normalized.match(ES_NIF)
    if (nif) {
      if (!validateSpanishNifLetter(nif[1], nif[2])) return { valid: false, code: 'INVALID_CHECKSUM' }
      return { valid: true, normalized: `${nif[1]}${nif[2].toUpperCase()}` }
    }
    const nie = normalized.match(ES_NIE)
    if (nie) {
      const map: Record<string, string> = { X: '0', Y: '1', Z: '2' }
      const asNif = `${map[nie[0][0]]}${nie[1]}`
      if (!validateSpanishNifLetter(asNif, nie[2])) return { valid: false, code: 'INVALID_CHECKSUM' }
      return { valid: true, normalized: normalized.toUpperCase() }
    }
    if (ES_CIF.test(normalized)) {
      if (!validateSpanishCif(normalized)) return { valid: false, code: 'INVALID_CHECKSUM' }
      return { valid: true, normalized: normalized.toUpperCase() }
    }
    return { valid: false, code: 'INVALID_FORMAT' }
  }

  return { valid: false, code: 'UNSUPPORTED_COUNTRY' }
}
