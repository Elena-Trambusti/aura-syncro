import type { FloorPlanLayoutV1 } from './floorPlanLayout'
import { FLOOR_CANVAS_H, FLOOR_CANVAS_W } from './floorPlanLayout'

export const OBSIDIAN_ROOM_TEMPLATE: FloorPlanLayoutV1 = {
  version: 1,
  canvas: { width: FLOOR_CANVAS_W, height: FLOOR_CANVAS_H },
  walls: [
    { id: 'w-perim-n', x1: 5, y1: 8, x2: 92, y2: 8, thickness: 1.4, height: 28 },
    { id: 'w-perim-s', x1: 5, y1: 88, x2: 92, y2: 88, thickness: 1.4, height: 28 },
    { id: 'w-perim-w', x1: 5, y1: 8, x2: 5, y2: 88, thickness: 1.4, height: 28 },
    { id: 'w-perim-e', x1: 92, y1: 8, x2: 92, y2: 88, thickness: 1.4, height: 28 },
    { id: 'w-kitchen-l', x1: 68, y1: 8, x2: 68, y2: 38, thickness: 1.2, height: 26 },
    { id: 'w-kitchen-b', x1: 68, y1: 38, x2: 92, y2: 38, thickness: 1.2, height: 26 },
    { id: 'w-reception', x1: 5, y1: 68, x2: 28, y2: 68, thickness: 1.2, height: 24 },
    { id: 'w-bar', x1: 28, y1: 68, x2: 55, y2: 68, thickness: 1, height: 20 },
  ],
  zoneLabels: [
    { id: 'zl-kitchen', textKey: 'tables.zones.kitchen', text: 'KITCHEN', x: 78, y: 22, variant: 'staff' },
    { id: 'zl-reception', textKey: 'tables.zones.reception', text: 'RECEPTION DESK', x: 14, y: 78, variant: 'room' },
    { id: 'zl-group', textKey: 'tables.zones.group', text: 'GROUP', x: 52, y: 48, variant: 'area' },
    { id: 'zl-bar', textKey: 'tables.zones.bar', text: 'BAR', x: 40, y: 78, variant: 'area' },
  ],
  zonePaths: [
    { id: 'zp-main-aisle', points: [{ x: 30, y: 55 }, { x: 55, y: 55 }, { x: 55, y: 72 }] },
  ],
}

export const DEFAULT_TABLE_POSITIONS_PERCENT = [
  { number: 1, seats: 2, posX: 18, posY: 22, shape: 'ROUND' as const, area: 'Sala' },
  { number: 2, seats: 4, posX: 32, posY: 20, shape: 'SQUARE' as const, area: 'Sala' },
  { number: 3, seats: 4, posX: 48, posY: 22, shape: 'SQUARE' as const, area: 'Sala' },
  { number: 4, seats: 6, posX: 62, posY: 52, shape: 'RECTANGLE' as const, area: 'Sala' },
  { number: 5, seats: 2, posX: 22, posY: 42, shape: 'ROUND' as const, area: 'Sala' },
  { number: 6, seats: 4, posX: 38, posY: 40, shape: 'SQUARE' as const, area: 'Sala' },
  { number: 7, seats: 4, posX: 54, posY: 38, shape: 'SQUARE' as const, area: 'Sala' },
  { number: 8, seats: 8, posX: 72, posY: 58, shape: 'RECTANGLE' as const, area: 'Group' },
]
