export const FLOOR_CANVAS_W = 1000
export const FLOOR_CANVAS_H = 800

export type FloorPlanWall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  thickness?: number
  height?: number
}

export type FloorPlanZoneLabel = {
  id: string
  text: string
  textKey?: string
  x: number
  y: number
  rotation?: number
  variant?: 'room' | 'staff' | 'area'
}

export type FloorPlanZonePath = {
  id: string
  points: Array<{ x: number; y: number }>
}

export type FloorPlanLayoutV1 = {
  version: 1
  canvas: { width: typeof FLOOR_CANVAS_W; height: typeof FLOOR_CANVAS_H }
  walls: FloorPlanWall[]
  zoneLabels: FloorPlanZoneLabel[]
  zonePaths?: FloorPlanZonePath[]
}

export const EMPTY_FLOOR_PLAN_LAYOUT: FloorPlanLayoutV1 = {
  version: 1,
  canvas: { width: FLOOR_CANVAS_W, height: FLOOR_CANVAS_H },
  walls: [],
  zoneLabels: [],
  zonePaths: [],
}

export function pctToPx(x: number, y: number, w = FLOOR_CANVAS_W, h = FLOOR_CANVAS_H) {
  return { px: (x / 100) * w, py: (y / 100) * h }
}

export function wallSegmentMetrics(
  wall: FloorPlanWall,
  canvasW = FLOOR_CANVAS_W,
  canvasH = FLOOR_CANVAS_H,
) {
  const x1 = (wall.x1 / 100) * canvasW
  const y1 = (wall.y1 / 100) * canvasH
  const x2 = (wall.x2 / 100) * canvasW
  const y2 = (wall.y2 / 100) * canvasH
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  const thicknessPx = ((wall.thickness ?? 1.2) / 100) * Math.min(canvasW, canvasH)
  return { x1, y1, length, angleDeg, thicknessPx, height: wall.height ?? 24 }
}
