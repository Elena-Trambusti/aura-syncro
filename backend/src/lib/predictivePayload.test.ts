import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildInventoryForecast,
  buildDishTrendsPayload,
  buildPredictiveInsights,
  resolveInventoryStatus,
} from './predictivePayload'
import type { AffluenceForecastDay, InventoryInput } from './predictiveEngine'

const sampleForecast: AffluenceForecastDay[] = [
  { date: '2026-07-05', dayOfWeek: 6, predictedCovers: 80, baseCovers: 70, weather: 'sunny', weatherImpactPct: 0, confidence: 80, historicalSamples: 4 },
  { date: '2026-07-06', dayOfWeek: 0, predictedCovers: 60, baseCovers: 55, weather: 'cloudy', weatherImpactPct: -5, confidence: 70, historicalSamples: 3 },
]

describe('predictivePayload', () => {
  it('resolveInventoryStatus — critical when below min threshold', () => {
    assert.equal(resolveInventoryStatus(3, 5, 10), 'critical')
  })

  it('resolveInventoryStatus — low when demand exceeds stock', () => {
    assert.equal(resolveInventoryStatus(12, 5, 20), 'low')
  })

  it('resolveInventoryStatus — overstock when stock >> demand', () => {
    assert.equal(resolveInventoryStatus(50, 5, 10), 'overstock')
  })

  it('buildInventoryForecast — maps expectedDemand to status and reorder qty', () => {
    const inventory: InventoryInput[] = [{
      id: 'inv-1',
      name: 'Farina',
      currentQuantity: 12,
      minimumThreshold: 5,
      unit: 'kg',
    }]

    const expectedDemand = {
      'inv-1': {
        6: { itemId: 'inv-1', dayOfWeek: 6, expectedQuantity: 10, sampleCount: 4, confidence: 80, method: 'moving_average_dow' as const },
        0: { itemId: 'inv-1', dayOfWeek: 0, expectedQuantity: 8, sampleCount: 3, confidence: 70, method: 'moving_average_dow' as const },
      },
    }

    const result = buildInventoryForecast(inventory, expectedDemand, sampleForecast)

    assert.equal(result.length, 1)
    assert.equal(result[0]!.itemName, 'Farina')
    assert.equal(result[0]!.demandNext7Days, 18)
    assert.equal(result[0]!.status, 'low')
    assert.equal(result[0]!.suggestedReorderQty, 6)
  })

  it('buildInventoryForecast — skips items without demand profile', () => {
    const inventory: InventoryInput[] = [{
      id: 'inv-orphan',
      name: 'Sale',
      currentQuantity: 100,
      minimumThreshold: 10,
      unit: 'kg',
    }]

    const result = buildInventoryForecast(inventory, {}, sampleForecast)
    assert.equal(result.length, 0)
  })

  it('buildDishTrendsPayload — classifies direction from growthPct', () => {
    const trends = buildDishTrendsPayload([
      { menuItemId: 'd1', name: 'Carbonara', qtyRecent2Weeks: 40, qtyPrev2Weeks: 20, growthPct: 100 },
      { menuItemId: 'd2', name: 'Insalata', qtyRecent2Weeks: 5, qtyPrev2Weeks: 10, growthPct: -50 },
      { menuItemId: 'd3', name: 'Tiramisu', qtyRecent2Weeks: 10, qtyPrev2Weeks: 10, growthPct: 0 },
    ])

    assert.equal(trends.find(t => t.dishId === 'd1')?.direction, 'up')
    assert.equal(trends.find(t => t.dishId === 'd2')?.direction, 'down')
    assert.equal(trends.find(t => t.dishId === 'd3')?.direction, 'stable')
  })

  it('buildPredictiveInsights — generates peak and inventory insights', () => {
    const inventoryForecast = buildInventoryForecast(
      [{ id: 'i1', name: 'Pesce', currentQuantity: 2, minimumThreshold: 5, unit: 'kg' }],
      {
        i1: {
          6: { itemId: 'i1', dayOfWeek: 6, expectedQuantity: 15, sampleCount: 4, confidence: 80, method: 'moving_average_dow' },
        },
      },
      sampleForecast,
    )

    const insights = buildPredictiveInsights({
      forecast: sampleForecast,
      inventoryForecast,
      dishTrends: [{ dishId: 'd1', dishName: 'Branzino', changePct: 40, direction: 'up' }],
    })

    assert.ok(insights.some(i => i.type === 'peak_day'))
    assert.ok(insights.some(i => i.type === 'inventory'))
    assert.ok(insights.some(i => i.type === 'trend'))
  })
})
