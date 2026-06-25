/**
 * Motore predittivo Aura Syncro — Statistica e Regole (v1)
 *
 * Layer puro, senza dipendenze esterne (no LLM, no API a pagamento).
 * I tipi strutturati sono pronti per un futuro enrichment narrativo via LLM:
 * ogni alert espone `context` + `ruleId` come payload per prompt downstream.
 */

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain'
export type AlertSeverity = 'critical' | 'optimization' | 'opportunity'

export interface PastSaleRecord {
  date: Date | string
  quantity: number
  /** Se omesso, derivato da `date` */
  dayOfWeek?: number
}

export interface ExpectedDemandResult {
  itemId: string
  dayOfWeek: number
  expectedQuantity: number
  sampleCount: number
  confidence: number
  method: 'moving_average_dow'
}

/** itemId → dayOfWeek (0–6) → risultato demand */
export type ExpectedDemandMap = Record<string, Record<number, ExpectedDemandResult>>

export interface InventoryInput {
  id: string
  name: string
  currentQuantity: number
  minimumThreshold: number
  unit: string
  category?: string | null
  /** Es. fresh_fish, outdoor — usato dalle regole meteo */
  tags?: string[]
}

export interface WeatherForecastDay {
  date: string
  dayOfWeek: number
  condition: WeatherCondition
}

export interface AffluenceForecastDay {
  date: string
  dayOfWeek: number
  predictedCovers: number
  baseCovers: number
  weather: WeatherCondition
  weatherImpactPct: number
  confidence: number
  historicalSamples: number
  /** Coperti già prenotati per questa data */
  reservedCovers?: number
  /** Stima walk-in oltre alle prenotazioni */
  walkInCovers?: number
}

export interface DishSalesTrend {
  menuItemId: string
  name: string
  qtyRecent2Weeks: number
  qtyPrev2Weeks: number
  growthPct: number
}

export interface SmartAlert {
  id: string
  ruleId: string
  severity: AlertSeverity
  i18nKey: string
  params: Record<string, string | number>
  /** Payload strutturato per futuro layer LLM (narrativa discorsiva) */
  context?: Record<string, unknown>
}

export interface GenerateAlertsOptions {
  weekendDays?: number[]
  rainReductionPct?: number
  growthThresholdPct?: number
  dishTrends?: DishSalesTrend[]
  affluenceForecast?: AffluenceForecastDay[]
}

export interface PredictiveEngineOutput {
  forecast: AffluenceForecastDay[]
  alerts: SmartAlert[]
  expectedDemand: ExpectedDemandMap
  factorsUsed: ('orderHistory' | 'dayOfWeek' | 'weather' | 'reservations')[]
  engineVersion: 'statistical_rules_v1' | 'statistical_rules_v2'
  generatedAt: string
  weatherSource?: 'open-meteo' | 'simulated'
}

const DAY_I18N_KEYS = [
  'aiPredictive.days.sunday',
  'aiPredictive.days.monday',
  'aiPredictive.days.tuesday',
  'aiPredictive.days.wednesday',
  'aiPredictive.days.thursday',
  'aiPredictive.days.friday',
  'aiPredictive.days.saturday',
] as const

const WEATHER_IMPACT: Record<WeatherCondition, number> = {
  sunny: 1,
  cloudy: 0.92,
  rain: 0.75,
}

const DEFAULT_WEEKEND_DAYS = [0, 6] // domenica, sabato
const FISH_PATTERN = /pesce|branzino|fish|pescado|fisch|salmone|tonno|gamber/i
const OUTDOOR_PATTERN = /terrazz|estern|outdoor|dehors|giardino|patio/i

const HOLIDAY_MULTIPLIERS: Record<string, number> = {
  '01-01': 1.5, // Capodanno
  '02-14': 1.8, // San Valentino
  '03-08': 1.3, // Festa della Donna
  '04-25': 1.5, // Liberazione
  '05-01': 1.5, // Festa dei Lavoratori
  '06-02': 1.4, // Festa della Repubblica
  '08-15': 1.8, // Ferragosto
  '10-31': 1.4, // Halloween
  '12-24': 1.6, // Vigilia
  '12-25': 2.0, // Natale
  '12-26': 1.5, // Santo Stefano
  '12-31': 2.5, // San Silvestro
}

export function getDayI18nKey(dayOfWeek: number): string {
  return DAY_I18N_KEYS[dayOfWeek] ?? DAY_I18N_KEYS[1]
}

function parseDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

function getDayOfWeek(record: PastSaleRecord): number {
  return record.dayOfWeek ?? parseDate(record.date).getDay()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isWeekend(dayOfWeek: number, weekendDays: number[]): boolean {
  return weekendDays.includes(dayOfWeek)
}

function inferInventoryTags(item: InventoryInput): string[] {
  const tags = new Set(item.tags ?? [])
  const haystack = `${item.name} ${item.category ?? ''}`.toLowerCase()
  if (FISH_PATTERN.test(haystack) || item.category?.toLowerCase() === 'pesce') {
    tags.add('fresh_fish')
  }
  if (OUTDOOR_PATTERN.test(haystack)) {
    tags.add('outdoor')
  }
  return [...tags]
}

/**
 * Media mobile delle vendite dello stesso giorno della settimana (ultime N settimane).
 */
export function calculateExpectedDemand(
  itemId: string,
  pastSales: PastSaleRecord[],
  dayOfWeek: number,
  options: { windowWeeks?: number } = {},
): ExpectedDemandResult {
  const windowWeeks = options.windowWeeks ?? 4
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - windowWeeks * 7)

  const yoyCutoffStart = new Date(cutoff)
  yoyCutoffStart.setFullYear(yoyCutoffStart.getFullYear() - 1)
  const yoyCutoffEnd = new Date()
  yoyCutoffEnd.setHours(0, 0, 0, 0)
  yoyCutoffEnd.setFullYear(yoyCutoffEnd.getFullYear() - 1)

  const recentSamples = pastSales.filter(record => {
    const date = parseDate(record.date)
    return date >= cutoff && getDayOfWeek(record) === dayOfWeek
  })

  const yoySamples = pastSales.filter(record => {
    const date = parseDate(record.date)
    return date >= yoyCutoffStart && date <= yoyCutoffEnd && getDayOfWeek(record) === dayOfWeek
  })

  const sampleCount = recentSamples.length + yoySamples.length

  if (sampleCount === 0) {
    return {
      itemId,
      dayOfWeek,
      expectedQuantity: 0,
      sampleCount: 0,
      confidence: 0,
      method: 'moving_average_dow',
    }
  }

  const recentTotal = recentSamples.reduce((sum, s) => sum + s.quantity, 0)
  const recentAvg = recentSamples.length > 0 ? recentTotal / recentSamples.length : 0

  const yoyTotal = yoySamples.reduce((sum, s) => sum + s.quantity, 0)
  const yoyAvg = yoySamples.length > 0 ? yoyTotal / yoySamples.length : 0

  let expectedQuantity = 0
  if (recentSamples.length > 0 && yoySamples.length > 0) {
    expectedQuantity = round2((recentAvg * 0.7) + (yoyAvg * 0.3))
  } else if (recentSamples.length > 0) {
    expectedQuantity = round2(recentAvg)
  } else {
    expectedQuantity = round2(yoyAvg)
  }

  const confidence = Math.min(95, Math.round(40 + sampleCount * 10 + (yoySamples.length > 0 ? 10 : 0)))

  return {
    itemId,
    dayOfWeek,
    expectedQuantity,
    sampleCount,
    confidence,
    method: 'moving_average_dow',
  }
}

/** Calcola demand per tutti i giorni 0–6 di un articolo */
export function calculateWeeklyDemandProfile(
  itemId: string,
  pastSales: PastSaleRecord[],
  options?: { windowWeeks?: number },
): Record<number, ExpectedDemandResult> {
  const profile: Record<number, ExpectedDemandResult> = {}
  for (let dow = 0; dow < 7; dow++) {
    profile[dow] = calculateExpectedDemand(itemId, pastSales, dow, options)
  }
  return profile
}

/**
 * Aggrega demand da vendite piatti → consumo inventario via BOM (menuLinks).
 * `recipeQty` = quantità inventario per unità piatto venduta.
 */
export function aggregateInventoryDemand(
  inventoryId: string,
  linkedMenuDemands: Array<{ menuItemId: string; recipeQty: number; pastSales: PastSaleRecord[] }>,
  options?: { windowWeeks?: number },
): ExpectedDemandMap[string] {
  const aggregated: Record<number, ExpectedDemandResult> = {}

  for (let dow = 0; dow < 7; dow++) {
    let expectedQuantity = 0
    let sampleCount = 0
    let confidenceSum = 0
    let sources = 0

    for (const link of linkedMenuDemands) {
      const dishDemand = calculateExpectedDemand(link.menuItemId, link.pastSales, dow, options)
      if (dishDemand.sampleCount > 0) {
        expectedQuantity += dishDemand.expectedQuantity * link.recipeQty
        sampleCount = Math.max(sampleCount, dishDemand.sampleCount)
        confidenceSum += dishDemand.confidence
        sources += 1
      }
    }

    aggregated[dow] = {
      itemId: inventoryId,
      dayOfWeek: dow,
      expectedQuantity: round2(expectedQuantity),
      sampleCount,
      confidence: sources > 0 ? Math.round(confidenceSum / sources) : 0,
      method: 'moving_average_dow',
    }
  }

  return aggregated
}

/** Meteo simulato trasparente (fallback neutrale) */
export function buildWeatherForecast(daysAhead = 7, startOffset = 1): WeatherForecastDay[] {
  const forecast: WeatherForecastDay[] = []

  for (let i = startOffset; i < startOffset + daysAhead; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    forecast.push({
      date: date.toISOString().split('T')[0]!,
      dayOfWeek: date.getDay(),
      condition: 'unknown' as any,
    })
  }

  return forecast
}

/**
 * Previsione affluenza avanzata: prenotazioni note + walk-in storico + meteo reale.
 */
export function calculateAffluenceForecastAdvanced(
  coverHistory: PastSaleRecord[],
  reservationHistory: PastSaleRecord[],
  weatherForecast: WeatherForecastDay[],
  upcomingReservations: Record<string, number>,
  options?: { windowWeeks?: number; defaultCovers?: number },
): AffluenceForecastDay[] {
  const defaultCovers = options?.defaultCovers ?? 45

  const avgReservedByDow: Record<number, number> = {}
  for (let dow = 0; dow < 7; dow++) {
    const demand = calculateExpectedDemand('__reserved__', reservationHistory, dow, options)
    avgReservedByDow[dow] = demand.sampleCount > 0 ? demand.expectedQuantity : 0
  }

  return weatherForecast.map(day => {
    const dateObj = new Date(day.date)
    const monthDay = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    const holidayMult = HOLIDAY_MULTIPLIERS[monthDay] ?? 1.0

    const demand = calculateExpectedDemand('__covers__', coverHistory, day.dayOfWeek, options)
    const historicalAvg = demand.sampleCount > 0
      ? Math.round(demand.expectedQuantity)
      : defaultCovers

    const reservedCovers = upcomingReservations[day.date] ?? 0
    const avgReservedOnDow = Math.round(avgReservedByDow[day.dayOfWeek] ?? 0)
    const walkInBase = Math.max(0, historicalAvg - avgReservedOnDow)
    const baseCovers = reservedCovers + Math.round(walkInBase * holidayMult)

    const weatherMult = WEATHER_IMPACT[day.condition] ?? 1.0
    const weatherImpactPct = day.condition === 'unknown' ? 0 : Math.round((weatherMult - 1) * 100)
    const predictedCovers = Math.max(0, Math.round(baseCovers * weatherMult))

    const confidence = demand.sampleCount > 0
      ? Math.min(95, Math.round(50 + demand.sampleCount * 10 + (reservedCovers > 0 ? 15 : 0)))
      : reservedCovers > 0 ? 70 : 50

    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      predictedCovers,
      baseCovers,
      weather: day.condition,
      weatherImpactPct,
      confidence,
      historicalSamples: demand.sampleCount,
      reservedCovers,
      walkInCovers: walkInBase,
    }
  })
}

/**
 * Previsione affluenza (coperti) — media mobile DOW + aggiustamento meteo.
 */
export function calculateAffluenceForecast(
  coverHistory: PastSaleRecord[],
  weatherForecast: WeatherForecastDay[],
  options?: { windowWeeks?: number; defaultCovers?: number },
): AffluenceForecastDay[] {
  const defaultCovers = options?.defaultCovers ?? 45

  return weatherForecast.map(day => {
    const dateObj = new Date(day.date)
    const monthDay = `${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    const holidayMult = HOLIDAY_MULTIPLIERS[monthDay] ?? 1.0

    const demand = calculateExpectedDemand('__covers__', coverHistory, day.dayOfWeek, options)
    const baseCovers = demand.sampleCount > 0
      ? Math.round(demand.expectedQuantity * holidayMult)
      : Math.round(defaultCovers * holidayMult)
      
    const weatherMult = WEATHER_IMPACT[day.condition] ?? 1.0
    const weatherImpactPct = day.condition === 'unknown' ? 0 : Math.round((weatherMult - 1) * 100)
    const predictedCovers = Math.max(0, Math.round(baseCovers * weatherMult))

    return {
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      predictedCovers,
      baseCovers,
      weather: day.condition,
      weatherImpactPct,
      confidence: demand.confidence || 50,
      historicalSamples: demand.sampleCount,
    }
  })
}

/** Trend vendite piatto: ultime 2 settimane vs 2 settimane precedenti */
export function computeDishTrend(
  menuItemId: string,
  name: string,
  pastSales: PastSaleRecord[],
): DishSalesTrend {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const fourWeeksAgo = new Date(now)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  let qtyRecent2Weeks = 0
  let qtyPrev2Weeks = 0

  for (const sale of pastSales) {
    const date = parseDate(sale.date)
    if (date >= twoWeeksAgo) {
      qtyRecent2Weeks += sale.quantity
    } else if (date >= fourWeeksAgo) {
      qtyPrev2Weeks += sale.quantity
    }
  }

  const growthPct = qtyPrev2Weeks > 0
    ? Math.round(((qtyRecent2Weeks - qtyPrev2Weeks) / qtyPrev2Weeks) * 100)
    : qtyRecent2Weeks > 0 ? 100 : 0

  return { menuItemId, name, qtyRecent2Weeks, qtyPrev2Weeks, growthPct }
}

/**
 * Generatore di alert rule-based.
 * REGOLA 1: stock < demand weekend → CRITICO
 * REGOLA 2: pioggia + pesce/esterno → OTTIMIZZAZIONE (-25%)
 * REGOLA 3: crescita vendite ≥ soglia → OPPORTUNITÀ
 */
export function generateSmartAlerts(
  inventory: InventoryInput[],
  expectedDemand: ExpectedDemandMap,
  weatherForecast: WeatherForecastDay[],
  options: GenerateAlertsOptions = {},
): SmartAlert[] {
  const {
    weekendDays = DEFAULT_WEEKEND_DAYS,
    rainReductionPct = 25,
    growthThresholdPct = 30,
    dishTrends = [],
    affluenceForecast = [],
  } = options

  const alerts: SmartAlert[] = []
  const rainyDays = weatherForecast.filter(d => d.condition === 'rain')

  // ── REGOLA 1: stock insufficiente per demand weekend ─────────────────────
  for (const item of inventory) {
    const demandProfile = expectedDemand[item.id]
    if (!demandProfile) continue

    let peakWeekendDemand = 0
    let peakDow = weekendDays[0]

    for (const dow of weekendDays) {
      const demand = demandProfile[dow]?.expectedQuantity ?? 0
      if (demand > peakWeekendDemand) {
        peakWeekendDemand = demand
        peakDow = dow
      }
    }

    if (peakWeekendDemand <= 0) continue

    const affluenceDay = affluenceForecast.find(d => d.dayOfWeek === peakDow)
    const covers = affluenceDay?.predictedCovers ?? Math.round(peakWeekendDemand * 10)

    if (item.currentQuantity < peakWeekendDemand) {
      const orderQty = round2(Math.max(
        item.minimumThreshold,
        peakWeekendDemand - item.currentQuantity,
      ))

      alerts.push({
        id: `rule1-stock-${item.id}-${peakDow}`,
        ruleId: 'RULE_STOCK_WEEKEND',
        severity: 'critical',
        i18nKey: 'aiPredictive.alerts.stockCritical',
        params: {
          covers,
          dayKey: getDayI18nKey(peakDow),
          item: item.name,
          qty: round2(item.currentQuantity),
          unit: item.unit,
          orderQty: Math.ceil(orderQty),
        },
        context: {
          rule: 'RULE_STOCK_WEEKEND',
          itemId: item.id,
          peakWeekendDemand,
          currentQuantity: item.currentQuantity,
          minimumThreshold: item.minimumThreshold,
          dayOfWeek: peakDow,
        },
      })
    }
  }

  // ── REGOLA 2: pioggia → riduci pesce fresco / outdoor ────────────────────
  for (const rainyDay of rainyDays) {
    for (const item of inventory) {
      const tags = inferInventoryTags(item)
      const isWeatherSensitive = tags.includes('fresh_fish') || tags.includes('outdoor')
      if (!isWeatherSensitive) continue

      alerts.push({
        id: `rule2-weather-${item.id}-${rainyDay.date}`,
        ruleId: 'RULE_WEATHER_REDUCTION',
        severity: 'optimization',
        i18nKey: 'aiPredictive.alerts.rainFish',
        params: {
          dayKey: getDayI18nKey(rainyDay.dayOfWeek),
          pct: rainReductionPct,
          item: item.name,
        },
        context: {
          rule: 'RULE_WEATHER_REDUCTION',
          itemId: item.id,
          weather: rainyDay.condition,
          reductionPct: rainReductionPct,
          tags,
          date: rainyDay.date,
        },
      })
    }
  }

  // ── REGOLA 3: crescita vendite piatto ────────────────────────────────────
  for (const trend of dishTrends) {
    if (trend.growthPct < growthThresholdPct || trend.qtyPrev2Weeks < 3) continue

    alerts.push({
      id: `rule3-trend-${trend.menuItemId}`,
      ruleId: 'RULE_DISH_GROWTH',
      severity: 'opportunity',
      i18nKey: 'aiPredictive.alerts.trendDish',
      params: {
        dish: trend.name,
        pct: trend.growthPct,
      },
      context: {
        rule: 'RULE_DISH_GROWTH',
        menuItemId: trend.menuItemId,
        qtyRecent2Weeks: trend.qtyRecent2Weeks,
        qtyPrev2Weeks: trend.qtyPrev2Weeks,
        growthPct: trend.growthPct,
      },
    })
  }

  // ── REGOLA 4: rischio spreco (WASTE RISK) ────────────────────────────────
  for (const item of inventory) {
    const tags = inferInventoryTags(item)
    // Solo deperibili (pesce fresco o esplicitamente taggati)
    if (!tags.includes('fresh_fish') && !tags.includes('perishable')) continue

    const demandProfile = expectedDemand[item.id]
    if (!demandProfile) continue

    let totalDemand7Days = 0
    for (let dow = 0; dow < 7; dow++) {
      totalDemand7Days += demandProfile[dow]?.expectedQuantity ?? 0
    }

    // Se la scorta è superiore al 200% del fabbisogno settimanale
    if (totalDemand7Days > 0 && item.currentQuantity > totalDemand7Days * 2) {
      alerts.push({
        id: `rule4-waste-${item.id}`,
        ruleId: 'RULE_WASTE_RISK',
        severity: 'optimization',
        i18nKey: 'aiPredictive.alerts.wasteRisk',
        params: {
          item: item.name,
          qty: round2(item.currentQuantity),
          demand: round2(totalDemand7Days),
        },
        context: {
          rule: 'RULE_WASTE_RISK',
          itemId: item.id,
          currentQuantity: item.currentQuantity,
          totalDemand7Days,
          tags,
        },
      })
    }
  }

  return dedupeAlerts(alerts)
}

function dedupeAlerts(alerts: SmartAlert[]): SmartAlert[] {
  const seen = new Set<string>()
  return alerts.filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })
}

/** Orchestrazione pura — combina forecast + alert in un unico payload */
export function runPredictiveEngine(input: {
  inventory: InventoryInput[]
  expectedDemand: ExpectedDemandMap
  coverHistory: PastSaleRecord[]
  reservationHistory?: PastSaleRecord[]
  upcomingReservations?: Record<string, number>
  dishTrends: DishSalesTrend[]
  weatherForecast?: WeatherForecastDay[]
  weatherSource?: 'open-meteo' | 'simulated'
}): PredictiveEngineOutput {
  const weatherForecast = input.weatherForecast ?? buildWeatherForecast()
  const useAdvanced = input.reservationHistory != null || input.upcomingReservations != null

  const forecast = useAdvanced
    ? calculateAffluenceForecastAdvanced(
      input.coverHistory,
      input.reservationHistory ?? [],
      weatherForecast,
      input.upcomingReservations ?? {},
    )
    : calculateAffluenceForecast(input.coverHistory, weatherForecast)

  const alerts = generateSmartAlerts(
    input.inventory,
    input.expectedDemand,
    weatherForecast,
    {
      dishTrends: input.dishTrends,
      affluenceForecast: forecast,
    },
  )

  const factorsUsed: PredictiveEngineOutput['factorsUsed'] = ['orderHistory', 'dayOfWeek', 'weather']
  if (useAdvanced) factorsUsed.push('reservations')

  return {
    forecast,
    alerts,
    expectedDemand: input.expectedDemand,
    factorsUsed,
    engineVersion: useAdvanced ? 'statistical_rules_v2' : 'statistical_rules_v1',
    generatedAt: new Date().toISOString(),
    weatherSource: input.weatherSource ?? (input.weatherForecast ? 'simulated' : 'simulated'),
  }
}
