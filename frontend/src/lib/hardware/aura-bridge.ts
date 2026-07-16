/**
 * Copia questi file nel progetto Next.js:
 * - public/aura-android-bridge.js  (copia da web-integration/aura-android-bridge.js)
 * - lib/hardware/aura-bridge.ts
 * - lib/hardware/escpos-builder.ts
 * - lib/hardware/print-service.ts
 * - lib/hardware/pos-service.ts
 * - lib/hardware/hardware-config.ts
 */

export interface BridgeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PrinterConfig {
  id: string;
  label: string;
  type: 'bluetooth' | 'wifi';
  address: string;
}

export interface PosConfig {
  packageName: string;
  label: string;
  deepLinkTemplate?: string;
}

export interface HardwareConfig {
  printers: PrinterConfig[];
  pos: PosConfig | null;
  defaultPrinterId: string | null;
}

export interface PaymentResult {
  status: string;
  orderId: string;
  txId?: string | null;
  /** Alternate ref fields from native POS bridges */
  transactionId?: string | null;
  receiptId?: string | null;
  reference?: string | null;
  source?: string;
  amountCents?: number;
  currency?: string;
  packageName?: string;
}

export interface AuraNative {
  isAvailable: boolean;
  getHardwareConfig(): BridgeResponse<HardwareConfig>;
  saveHardwareConfig(config: HardwareConfig): BridgeResponse<HardwareConfig>;
  requestPermissions(): BridgeResponse;
  hasPermissions(): BridgeResponse<{ granted: boolean }>;
  isBluetoothEnabled(): BridgeResponse<{ enabled: boolean }>;
  openBluetoothSettings(): BridgeResponse;
  scanPrinters(includeDiscovery?: boolean): BridgeResponse<Array<{ id: string; name: string; type: string; address: string }>>;
  testPrinterConnection(type: string, address: string, name?: string): BridgeResponse;
  connectPrinter(type: string, address: string, name?: string): BridgeResponse;
  printToSavedPrinter(printerId: string, base64: string): BridgeResponse;
  listPosApps(): BridgeResponse<Array<{ packageName: string; label: string; launchable?: boolean }>>;
  listLaunchableApps(query?: string): BridgeResponse<Array<{ packageName: string; label: string; launchable?: boolean }>>;
  probePosApp(packageName: string): BridgeResponse<{ installed: boolean; launchable: boolean; label?: string }>;
  openConfiguredPosPayment(amountCents: number, orderId: string, currency?: string): BridgeResponse;
  confirmPayment(orderId: string, status: string, txId?: string): BridgeResponse<PaymentResult>;
  getPendingPayment(): BridgeResponse<{ pending: boolean; orderId?: string }>;
  cancelPendingPayment(): BridgeResponse;
}

declare global {
  interface Window {
    AuraSyncro?: {
      isAndroidApp(): boolean;
      onReady(cb: (native: AuraNative) => void): void;
      onPaymentResult(cb: (result: PaymentResult) => void): void;
      onAppResumed(cb: (detail: { pendingPayment: boolean; payment?: PaymentResult }) => void): void;
      onPermissionsResult(cb: (detail: { granted: boolean }) => void): void;
      getNative(): AuraNative;
    };
  }
}

export function isAndroidTablet(): boolean {
  return typeof window !== 'undefined' && window.AuraSyncro?.isAndroidApp() === true;
}

const DEFAULT_NATIVE_READY_TIMEOUT_MS = 8_000

/**
 * Invokes callback when the Android bridge is ready.
 * Always settles (success or timeout) so print/POS promises cannot hang forever.
 */
export function onNativeReady(
  callback: (native: AuraNative) => void,
  options?: { timeoutMs?: number; onTimeout?: () => void },
): void {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_NATIVE_READY_TIMEOUT_MS
  let settled = false
  const settle = (fn: () => void) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    fn()
  }

  const timer = setTimeout(() => {
    settle(() => {
      const native = typeof window !== 'undefined' ? window.AuraSyncro?.getNative?.() : undefined
      if (native) {
        callback(native)
        return
      }
      options?.onTimeout?.()
    })
  }, timeoutMs)

  if (typeof window === 'undefined' || !window.AuraSyncro?.onReady) {
    settle(() => options?.onTimeout?.())
    return
  }

  window.AuraSyncro.onReady((native) => {
    settle(() => callback(native))
  })
}
