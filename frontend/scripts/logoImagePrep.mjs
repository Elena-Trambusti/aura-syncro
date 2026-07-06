/**
 * Prepara il master logo: rimuove angoli neri/bianchi, trim, full-bleed.
 */
import sharp from 'sharp'

/** Rimuove pixel neri (angoli) e aloni bianchi dai bordi. */
export async function stripLogoHalos(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const isDark = r < 48 && g < 48 && b < 48
    const isWhiteHalo = r > 232 && g > 228 && b > 220
    if (isDark || isWhiteHalo) {
      data[i + 3] = 0
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 2 })
    .png()
    .toBuffer()
}

/** Logo ritagliato ridimensionato a riempire tutto il canvas (nessun margine). */
export async function logoToSquarePng(preparedLogo, size, fillRatio = 1) {
  const side = Math.max(1, Math.round(size * fillRatio))
  const mark = await sharp(preparedLogo)
    .resize(side, side, {
      fit: 'cover',
      position: 'centre',
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
}

/** WebP display con alpha per UI (nav, badge, toast). */
export async function logoToDisplayWebp(preparedLogo, width, quality = 88) {
  return sharp(preparedLogo)
    .resize(width, width, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .webp({ quality, effort: 6, alphaQuality: 100 })
    .toBuffer()
}
