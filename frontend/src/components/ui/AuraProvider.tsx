import type { ReactNode } from 'react'
import { AuraTooltipProvider } from './AuraTooltip'

/** Provider Radix condiviso — tooltip e futuri primitive client-side. */
export default function AuraProvider({ children }: { children: ReactNode }) {
  return <AuraTooltipProvider>{children}</AuraTooltipProvider>
}
