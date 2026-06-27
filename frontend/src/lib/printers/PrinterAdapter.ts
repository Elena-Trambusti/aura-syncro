export interface PrintItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface PrintOrder {
  id: string;
  items: PrintItem[];
  total: number;
  paymentMethod?: string;
}

export interface PrinterAdapter {
  /**
   * Genera il payload crudo (XML/JSON/TCP) per la stampante fiscale
   */
  generateReceiptPayload(order: PrintOrder): string;
  
  /**
   * Genera il payload per la chiusura cassa (Zeta)
   */
  generateZReportPayload(): string;

  /**
   * Headers HTTP specifici richiesti dalla stampante
   */
  getHeaders(): Record<string, string>;

  /**
   * Endpoint HTTP della stampante (es. /cgi-bin/fiscprint)
   */
  getEndpoint(): string;
}
