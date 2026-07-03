import { z } from 'zod'

export const FLOOR_CANVAS_W = 1000
export const FLOOR_CANVAS_H = 800

const pct = z.number().min(0).max(100)

export const floorPlanWallSchema = z.object({
  id: z.string().min(1),
  x1: pct,
  y1: pct,
  x2: pct,
  y2: pct,
  thickness: pct.optional(),
  height: z.number().min(4).max(80).optional(),
})

export const floorPlanZoneLabelSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(80),
  textKey: z.string().max(120).optional(),
  x: pct,
  y: pct,
  rotation: z.number().optional(),
  variant: z.enum(['room', 'staff', 'area']).optional(),
})

export const floorPlanZonePathSchema = z.object({
  id: z.string().min(1),
  points: z.array(z.object({ x: pct, y: pct })).min(2),
})

export const floorPlanLayoutSchema = z.object({
  version: z.literal(1),
  canvas: z.object({
    width: z.literal(FLOOR_CANVAS_W),
    height: z.literal(FLOOR_CANVAS_H),
  }),
  walls: z.array(floorPlanWallSchema),
  zoneLabels: z.array(floorPlanZoneLabelSchema),
  zonePaths: z.array(floorPlanZonePathSchema).optional(),
  areas: z.array(z.string().min(1).max(80)).optional(),
})

export type FloorPlanLayoutV1 = z.infer<typeof floorPlanLayoutSchema>
export type FloorPlanWall = z.infer<typeof floorPlanWallSchema>
export type FloorPlanZoneLabel = z.infer<typeof floorPlanZoneLabelSchema>
export type FloorPlanZonePath = z.infer<typeof floorPlanZonePathSchema>

export const EMPTY_FLOOR_PLAN_LAYOUT: FloorPlanLayoutV1 = {
  version: 1,
  canvas: { width: FLOOR_CANVAS_W, height: FLOOR_CANVAS_H },
  walls: [],
  zoneLabels: [],
  zonePaths: [],
}

export function parseFloorPlanLayout(raw: unknown): FloorPlanLayoutV1 {
  const result = floorPlanLayoutSchema.safeParse(raw)
  if (result.success) return result.data
  return EMPTY_FLOOR_PLAN_LAYOUT
}
