import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

interface PredictiveMobileTabsProps {
  mainContent: ReactNode
  inventoryContent: ReactNode
  trendsContent: ReactNode
  insightsContent: ReactNode
}

type TabId = 'overview' | 'inventory' | 'trends' | 'insights'

export default function PredictiveMobileTabs({
  mainContent,
  inventoryContent,
  trendsContent,
  insightsContent,
}: PredictiveMobileTabsProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<TabId>('overview')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: t('aiPredictive.tabs.overview') },
    { id: 'inventory', label: t('aiPredictive.tabs.inventory') },
    { id: 'trends', label: t('aiPredictive.tabs.trends') },
    { id: 'insights', label: t('aiPredictive.tabs.insights') },
  ]

  const content: Record<TabId, ReactNode> = {
    overview: mainContent,
    inventory: inventoryContent,
    trends: trendsContent,
    insights: insightsContent,
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'shrink-0 whitespace-nowrap',
              active === tab.id ? 'aura-tab-active' : 'aura-tab-inactive',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{content[active]}</div>
    </div>
  )
}
