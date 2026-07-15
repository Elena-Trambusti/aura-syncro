import { buildCustomerReceipt, buildKitchenTicket, toBase64, type ReceiptLine } from './escpos-builder';
import { loadHardwareConfig } from './hardware-config';
import { isAndroidTablet, onNativeReady } from './aura-bridge';
import { addMoney, moneyNumber } from '../money';

export async function printKitchenOrder(
  orderId: string,
  table: string,
  items: ReceiptLine[],
  printerId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isAndroidTablet()) {
    return { ok: false, error: 'KITCHEN_PRINT_NATIVE_ONLY' };
  }

  return new Promise((resolve) => {
    onNativeReady((native) => {
      const config = native.getHardwareConfig().data;
      const targetPrinterId = printerId ?? config?.defaultPrinterId;

      if (!targetPrinterId) {
        resolve({ ok: false, error: 'Nessuna stampante configurata' });
        return;
      }

      const payload = toBase64(buildKitchenTicket(orderId, table, items));
      const result = native.printToSavedPrinter(targetPrinterId, payload);
      resolve(result.ok ? { ok: true } : { ok: false, error: result.error });
    });
  });
}

export async function printCustomerReceiptNative(
  order: {
    id: string;
    table?: { number: number };
    type: string;
    createdAt: string;
    items: Array<{ menuItem: { name: string }; quantity: number; unitPrice: number }>;
    subtotal: number;
    tax: number;
    total: number;
    revenueAmount?: number;
    tipAmount?: number;
    paymentMethod?: string;
  },
  restaurantName: string,
  options?: { taxLabel?: string; locale?: string; tipLabel?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!isAndroidTablet()) {
    return { ok: false, error: 'RECEIPT_PRINT_NATIVE_ONLY' };
  }

  const locale = options?.locale ?? 'it-IT';
  const taxLabel = options?.taxLabel ?? 'Tax';
  const tipLabel = options?.tipLabel ?? 'Mancia';
  const foodTotal = moneyNumber(order.revenueAmount) || addMoney(order.subtotal, order.tax);
  const tip = moneyNumber(order.tipAmount) || Math.max(0, moneyNumber(order.total) - foodTotal);

  const lines: ReceiptLine[] = order.items.map((item) => ({
    name: item.menuItem.name,
    qty: item.quantity,
    price: moneyNumber(item.unitPrice),
  }));

  const tableLabel = order.table ? `Tavolo ${order.table.number}` : undefined;
  const payload = toBase64(
    buildCustomerReceipt({
      orderId: order.id,
      restaurantName,
      tableLabel,
      orderType: order.type,
      createdAt: order.createdAt,
      lines,
      subtotal: moneyNumber(order.subtotal),
      tax: moneyNumber(order.tax),
      foodTotal,
      tip,
      total: moneyNumber(order.total),
      taxLabel,
      tipLabel,
      paymentMethod: order.paymentMethod,
      locale,
    }),
  );

  return new Promise((resolve) => {
    onNativeReady((native) => {
      const config = native.getHardwareConfig().data;
      const targetPrinterId = config?.defaultPrinterId;
      if (!targetPrinterId) {
        resolve({ ok: false, error: 'Nessuna stampante configurata' });
        return;
      }
      const result = native.printToSavedPrinter(targetPrinterId, payload);
      resolve(result.ok ? { ok: true } : { ok: false, error: result.error });
    });
  });
}

export async function testSavedPrinter(printerId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isAndroidTablet()) {
    return { ok: false, error: 'Test stampante disponibile solo su tablet Android' };
  }

  const config = await loadHardwareConfig();
  const printer = config.printers.find((item) => item.id === printerId);
  if (!printer) return { ok: false, error: 'Stampante non trovata' };

  return new Promise((resolve) => {
    onNativeReady((native) => {
      const result = native.testPrinterConnection(printer.type, printer.address, printer.label);
      resolve(result.ok ? { ok: true } : { ok: false, error: result.error });
    });
  });
}
