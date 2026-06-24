import type { PosIntegrationMode } from '@prisma/client'
import { prisma } from './prisma'

export type PosLegalReceiptSource = 'pending' | 'simulation' | 'stripe_terminal' | 'external_device'

export interface RestaurantPosConfig {
  mode: PosIntegrationMode
  providerLabel: string | null
  terminalId: string | null
  merchantId: string | null
  setupNotes: string | null
  configuredAt: Date | null
  /** true se l'addebito carta in Aura è simulato (non passa dal POS reale) */
  isCardChargeSimulated: boolean
  /** true se la ricevuta fiscale legale deve uscire dal POS del ristorante */
  usesExternalFiscalDevice: boolean
  legalReceiptSource: PosLegalReceiptSource
}

const DEFAULT_CONFIG: RestaurantPosConfig = {
  mode: 'PENDING_SETUP',
  providerLabel: null,
  terminalId: null,
  merchantId: null,
  setupNotes: null,
  configuredAt: null,
  isCardChargeSimulated: true,
  usesExternalFiscalDevice: false,
  legalReceiptSource: 'pending',
}

export async function loadRestaurantPosConfig(restaurantId: string): Promise<RestaurantPosConfig> {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: {
      posIntegrationMode: true,
      posProviderLabel: true,
      posTerminalId: true,
      posMerchantId: true,
      posSetupNotes: true,
      posConfiguredAt: true,
    },
  })

  if (!settings) return { ...DEFAULT_CONFIG }

  const mode = settings.posIntegrationMode ?? 'PENDING_SETUP'

  switch (mode) {
    case 'STRIPE_TERMINAL':
      return {
        mode,
        providerLabel: settings.posProviderLabel,
        terminalId: settings.posTerminalId,
        merchantId: settings.posMerchantId,
        setupNotes: settings.posSetupNotes,
        configuredAt: settings.posConfiguredAt,
        isCardChargeSimulated: false,
        usesExternalFiscalDevice: false,
        legalReceiptSource: 'stripe_terminal',
      }
    case 'EXTERNAL':
      return {
        mode,
        providerLabel: settings.posProviderLabel,
        terminalId: settings.posTerminalId,
        merchantId: settings.posMerchantId,
        setupNotes: settings.posSetupNotes,
        configuredAt: settings.posConfiguredAt,
        isCardChargeSimulated: true,
        usesExternalFiscalDevice: true,
        legalReceiptSource: 'external_device',
      }
    case 'SIMULATION':
      return {
        mode,
        providerLabel: settings.posProviderLabel,
        terminalId: settings.posTerminalId,
        merchantId: settings.posMerchantId,
        setupNotes: settings.posSetupNotes,
        configuredAt: settings.posConfiguredAt,
        isCardChargeSimulated: true,
        usesExternalFiscalDevice: false,
        legalReceiptSource: 'simulation',
      }
    case 'PENDING_SETUP':
    default:
      return {
        mode: 'PENDING_SETUP',
        providerLabel: settings.posProviderLabel,
        terminalId: settings.posTerminalId,
        merchantId: settings.posMerchantId,
        setupNotes: settings.posSetupNotes,
        configuredAt: settings.posConfiguredAt,
        isCardChargeSimulated: true,
        usesExternalFiscalDevice: false,
        legalReceiptSource: 'pending',
      }
  }
}

/** Payload pubblico per UI checkout (senza note interne concierge) */
export function serializePosStatusForCheckout(config: RestaurantPosConfig) {
  return {
    mode: config.mode,
    providerLabel: config.providerLabel,
    isCardChargeSimulated: config.isCardChargeSimulated,
    usesExternalFiscalDevice: config.usesExternalFiscalDevice,
    legalReceiptSource: config.legalReceiptSource,
    configured: config.mode !== 'PENDING_SETUP',
  }
}
