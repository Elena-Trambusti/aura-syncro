import { computeOrderTaxFromLines } from './taxEngine'

function test() {
  const lines = []
  for(let i=0; i<100; i++) {
    lines.push({ quantity: 1, unitPrice: Math.random() * 100 })
  }
  const config = { taxRate: 10, fiscalRegion: 'ITALIA' as const } as any
  const res = computeOrderTaxFromLines(config, lines)
  
  const diff = Math.abs(res.total - (res.subtotal + res.tax))
  if (diff > 0.001) {
    console.error(`ERRORE DI ARROTONDAMENTO! Diff: ${diff}`)
  } else {
    console.log('MATEMATICA PERFETTA.')
  }
}
test()
