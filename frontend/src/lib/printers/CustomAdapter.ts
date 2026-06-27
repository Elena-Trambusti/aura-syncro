import type { PrinterAdapter, PrintOrder } from './PrinterAdapter';

export class CustomAdapter implements PrinterAdapter {
  generateReceiptPayload(order: PrintOrder): string {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<Service>\n';
    xml += '  <cmd>\n';
    xml += '    <printRecMessage>\n';
    xml += '      <MessageItem>\n';
    
    // Testata
    xml += '        <printRecItemText><text>Scontrino Elettronico</text></printRecItemText>\n';
    
    // Righe scontrino
    order.items.forEach(item => {
      xml += '        <printRecItem>\n';
      xml += `          <description>${this.escape(item.description)}</description>\n`;
      xml += `          <quantity>${item.quantity}</quantity>\n`;
      xml += `          <unitPrice>${(item.unitPrice * 100).toFixed(0)}</unitPrice>\n`;
      xml += '          <department>1</department>\n';
      xml += '        </printRecItem>\n';
    });

    // Totale e chiusura scontrino
    xml += '        <printRecTotal>\n';
    xml += '          <operator>1</operator>\n';
    xml += `          <payment>${(order.total * 100).toFixed(0)}</payment>\n`;
    xml += '        </printRecTotal>\n';
    
    xml += '      </MessageItem>\n';
    xml += '    </printRecMessage>\n';
    xml += '  </cmd>\n';
    xml += '</Service>';
    
    return xml;
  }

  generateZReportPayload(): string {
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<Service>\n';
    xml += '  <cmd>\n';
    xml += '    <printZReport>\n';
    xml += '      <operator>1</operator>\n';
    xml += '      <timeout>5000</timeout>\n';
    xml += '    </printZReport>\n';
    xml += '  </cmd>\n';
    xml += '</Service>';
    return xml;
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/xml'
    };
  }

  getEndpoint(): string {
    return '/cgi-bin/fiscprint';
  }

  private escape(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
