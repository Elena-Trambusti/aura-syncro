/**
 * Ridimensiona il logo master senza alterare colori o forme.
 * Il file sorgente è sacro: nessun trim, nessuna rimozione pixel.
 */
import sharp from 'sharp'

/** Icona PWA / favicon — logo oro full-bleed, opaco. */
export async function logoToIconPng(logoBuffer, size) {
  return sharp(logoBuffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer()
}

/** WebP display per UI (nav, badge, toast) — solo ridimensionamento. */
export async function logoToDisplayWebp(logoBuffer, width, quality = 90) {
  return sharp(logoBuffer)
    .resize(width, width, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .webp({ quality, effort: 6 })
    .toBuffer()
}
