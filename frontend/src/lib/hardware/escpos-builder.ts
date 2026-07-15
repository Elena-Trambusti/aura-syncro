export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
}

export interface CustomerReceiptInput {
  orderId: string;
  restaurantName: string;
  tableLabel?: string;
  orderType?: string;
  createdAt: string;
  lines: ReceiptLine[];
  subtotal: number;
  tax: number;
  foodTotal: number;
  tip: number;
  total: number;
  taxLabel: string;
  tipLabel: string;
  paymentMethod?: string;
  locale?: string;
}

const ESC = 0x1b;
const GS = 0x1d;

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function text(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function rowLine(label: string, value: string): Uint8Array {
  const padding = ' '.repeat(Math.max(1, 32 - label.length - value.length));
  return text(`${label}${padding}${value}\n`);
}

export function buildKitchenTicket(
  orderId: string,
  table: string,
  lines: ReceiptLine[],
): Uint8Array {
  const header = concat(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01),
    cmd(ESC, 0x45, 0x01),
    text(`COMANDA #${orderId.slice(-6).toUpperCase()}\n`),
    cmd(ESC, 0x45, 0x00),
    text(`Tavolo: ${table}\n`),
    text(`${new Date().toLocaleTimeString('it-IT')}\n`),
    text('--------------------------------\n'),
    cmd(ESC, 0x61, 0x00),
  );

  const items = lines.map((line) => {
    const label = `${line.qty}x ${line.name}`;
    const price = `EUR ${(line.qty * line.price).toFixed(2)}`;
    const padding = ' '.repeat(Math.max(1, 32 - label.length - price.length));
    return text(`${label}${padding}${price}\n`);
  });

  const footer = concat(
    text('--------------------------------\n'),
    cmd(ESC, 0x61, 0x01),
    text('\n\n'),
    cmd(GS, 0x56, 0x01),
  );

  return concat(header, ...items, footer);
}

export function buildCustomerReceipt(input: CustomerReceiptInput): Uint8Array {
  const locale = input.locale ?? 'it-IT';
  const formatEur = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n);
  const formatDt = (d: string) =>
    new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  const place =
    input.tableLabel
    ?? (input.orderType === 'TAKEAWAY' ? 'Asporto' : input.orderType === 'DELIVERY' ? 'Delivery' : '');

  const paymentLabels: Record<string, string> = {
    CASH: 'Contanti',
    CARD: 'Carta',
    VOUCHER: 'Voucher',
    DIGITAL: 'Digitale',
  };

  const header = concat(
    cmd(ESC, 0x40),
    cmd(ESC, 0x61, 0x01),
    cmd(ESC, 0x45, 0x01),
    text(`${input.restaurantName}\n`),
    cmd(ESC, 0x45, 0x00),
    text(`${formatDt(input.createdAt)}\n`),
    text(`Ordine #${input.orderId.slice(-6).toUpperCase()}\n`),
    ...(place ? [text(`${place}\n`)] : []),
    text('--------------------------------\n'),
    cmd(ESC, 0x61, 0x00),
  );

  const items = input.lines.map((line) =>
    rowLine(
      `${line.qty}x ${line.name.substring(0, 20)}`,
      formatEur(line.qty * line.price),
    ),
  );

  const totals = [
    text('--------------------------------\n'),
    rowLine('Subtotale', formatEur(input.subtotal)),
    rowLine(input.taxLabel, formatEur(input.tax)),
    rowLine('Totale ristorante', formatEur(input.foodTotal)),
    ...(input.tip > 0 ? [rowLine(input.tipLabel, formatEur(input.tip))] : []),
    text('--------------------------------\n'),
    cmd(ESC, 0x45, 0x01),
    rowLine('TOTALE', formatEur(input.total)),
    cmd(ESC, 0x45, 0x00),
    ...(input.paymentMethod
      ? [rowLine('Pagamento', paymentLabels[input.paymentMethod] ?? input.paymentMethod)]
      : []),
    text('--------------------------------\n'),
    cmd(ESC, 0x61, 0x01),
    text('Grazie per la visita!\n'),
    text('Powered by Aura Syncro\n\n'),
    cmd(GS, 0x56, 0x01),
  ];

  return concat(header, ...items, ...totals);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
