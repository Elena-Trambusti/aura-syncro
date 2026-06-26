/**
 * Driver nativo ESC/POS per Aura Syncro (Web Serial API)
 * Permette la stampa termica diretta senza pop-up del browser e senza QZ Tray.
 * Compatibile con Chrome, Edge e browser Chromium su desktop e Android.
 */

export class EscPosPrinter {
  private buffer: number[] = []

  // --- Comandi Base ESC/POS ---
  init() {
    this.buffer.push(0x1b, 0x40) // ESC @ (Initialize)
    return this
  }

  align(align: 'left' | 'center' | 'right') {
    const a = align === 'left' ? 0 : align === 'center' ? 1 : 2
    this.buffer.push(0x1b, 0x61, a) // ESC a n
    return this
  }

  bold(on: boolean) {
    this.buffer.push(0x1b, 0x45, on ? 1 : 0) // ESC E n
    return this
  }

  size(width: 1 | 2, height: 1 | 2) {
    const w = width === 2 ? 0x10 : 0x00
    const h = height === 2 ? 0x01 : 0x00
    this.buffer.push(0x1d, 0x21, w | h) // GS ! n
    return this
  }

  text(text: string) {
    // Encoding basilare in ASCII (ISO-8859-1)
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i)
      // Fallback per caratteri speciali (Euro)
      if (code === 8364) code = 213 // € in alcune code page ESC/POS
      if (code > 255) code = 63 // ? 
      this.buffer.push(code)
    }
    return this
  }

  newline(count = 1) {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a) // LF
    }
    return this
  }

  cut() {
    this.buffer.push(0x1d, 0x56, 0x41, 0x00) // GS V A 0 (Partial/Full cut)
    return this
  }

  drawer() {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xff) // ESC p 0 (Kick drawer)
    return this
  }

  // Costruisce la riga in due colonne per i totali (es: "Pizza        10.00")
  row(left: string, right: string, width = 32) {
    const maxLeft = width - right.length
    const l = left.substring(0, maxLeft)
    const spaces = width - l.length - right.length
    this.text(l + ' '.repeat(Math.max(0, spaces)) + right).newline()
    return this
  }

  separator(char = '-', width = 32) {
    this.text(char.repeat(width)).newline()
    return this
  }

  // --- Sistema di Stampa Web Serial ---
  private async getPort(): Promise<any> {
    if (!('serial' in navigator)) {
      throw new Error('Il tuo browser non supporta la Web Serial API (Usa Chrome, Edge o Opera).')
    }
    
    // Richiede all'utente di selezionare la stampante USB (salva il permesso)
    try {
      const port = await (navigator as any).serial.requestPort()
      return port
    } catch (e) {
      console.warn('Selezione stampante annullata.')
      return null
    }
  }

  async printAndCut(): Promise<boolean> {
    try {
      const port = await this.getPort()
      if (!port) return false

      await port.open({ baudRate: 9600 }) // BaudRate standard ESC/POS

      const writer = port.writable.getWriter()
      const data = new Uint8Array(this.buffer)
      
      await writer.write(data)
      await writer.releaseLock()
      await port.close()
      
      this.buffer = [] // Reset buffer
      return true
    } catch (err: any) {
      console.error('Errore durante la stampa ESC/POS:', err)
      throw new Error('Impossibile comunicare con la stampante: ' + err.message)
    }
  }
}
