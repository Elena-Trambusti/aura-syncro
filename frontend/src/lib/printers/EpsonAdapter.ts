import type { PrinterAdapter, PrintOrder } from './PrinterAdapter';

export class EpsonAdapter implements PrinterAdapter {
  generateReceiptPayload(order: PrintOrder): string {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">\n';
    
    order.items.forEach(item => {
      xml += `  <text>${this.escape(item.description)} x${item.quantity}</text>\n`;
      xml += `  <text align="right">EUR ${item.unitPrice.toFixed(2)}</text>\n`;
      xml += `  <feed line="1" />\n`;
    });

    xml += `  <feed line="1" />\n`;
    xml += `  <text align="right" bold="true">TOTALE: EUR ${order.total.toFixed(2)}</text>\n`;
    xml += `  <feed line="1" />\n`;
    xml += `  <cut type="feed" />\n`;
    
    xml += '</epos-print>';
    
    return xml;
  }

  generateZReportPayload(): string {
    // Epson ePOS print command for Z report usually involves specific escape sequences
    // Or we trigger the fiscal closure via a specific ePOS-Fiscal XML.
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">\n';
    xml += '  <command>Z_REPORT</command>\n';
    xml += '</epos-print>';
    return xml;
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/xml; charset=utf-8'
    };
  }

  getEndpoint(): string {
    // Epson default ePOS-Print endpoint
    return '/cgi-bin/epos/dispacher.cgi';
  }

  private escape(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
