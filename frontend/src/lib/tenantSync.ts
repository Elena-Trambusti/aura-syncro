import type { Restaurant } from '../contexts/AuthContext'
import type { TaxRegion } from './fiscalRegime'

export interface TenantIdentity {
  restaurantId: string
  taxRegion: TaxRegion
  countryCode: string
}

/** Chiave stabile per dipendenze React — regime fiscale dal DB, mai da i18n */
export function tenantIdentity(restaurant: Restaurant | null): TenantIdentity | null {
  if (!restaurant?.id) return null
  return {
    restaurantId: restaurant.id,
    taxRegion: restaurant.taxRegion,
    countryCode: restaurant.countryCode,
  }
}

export function tenantIdentityKey(identity: TenantIdentity | null): string {
  if (!identity) return 'none'
  return `${identity.restaurantId}:${identity.taxRegion}:${identity.countryCode}`
}
