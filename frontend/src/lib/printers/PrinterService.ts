import { CustomAdapter } from './CustomAdapter';
import { EpsonAdapter } from './EpsonAdapter';
import type { PrinterAdapter, PrintOrder } from './PrinterAdapter';

export class PrinterService {
  private adapter: PrinterAdapter | null = null;
  private ipAddress: string | null = null;

  constructor(brand: string | null | undefined, ipAddress: string | null | undefined) {
    if (ipAddress) {
      this.ipAddress = ipAddress;
    }
    
    if (brand === 'CUSTOM') {
      this.adapter = new CustomAdapter();
    } else if (brand === 'EPSON') {
      this.adapter = new EpsonAdapter();
    }
  }

  private async sendRequest(payload: string): Promise<boolean> {
    if (!this.adapter || !this.ipAddress) {
      console.warn('Stampa saltata: Cassa non configurata');
      return false;
    }

    try {
      const endpoint = `http://${this.ipAddress}${this.adapter.getEndpoint()}`;
      console.log(`Invio stampa a ${endpoint}...`);
      
      await fetch(endpoint, {
        method: 'POST',
        headers: this.adapter.getHeaders(),
        body: payload,
        // modalita no-cors necessaria in PWA se la cassa non risponde con headers CORS, 
        // ma attenzione: no-cors non permette di leggere la risposta.
        mode: 'no-cors' 
      });

      console.log('Segnale di stampa inviato (Modalità no-cors/fire-and-forget).');
      return true;
    } catch (err) {
      console.error('Errore durante la connessione alla cassa:', err);
      return false;
    }
  }

  public async printReceipt(order: PrintOrder): Promise<boolean> {
    if (!this.adapter) return false;
    const payload = this.adapter.generateReceiptPayload(order);
    return this.sendRequest(payload);
  }

  public async printZReport(): Promise<boolean> {
    if (!this.adapter) return false;
    const payload = this.adapter.generateZReportPayload();
    return this.sendRequest(payload);
  }
}
