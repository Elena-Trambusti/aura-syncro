import type { FloorPlanWall as FloorPlanWallType } from '../../lib/floorPlanLayout'
import { FLOOR_CANVAS_H, FLOOR_CANVAS_W, wallSegmentMetrics } from '../../lib/floorPlanLayout'

const WALL_BODY_Z = 12

export default function FloorPlanWall({ wall }: { wall: FloorPlanWallType }) {
  const { x1, y1, length, angleDeg, thicknessPx, height } = wallSegmentMetrics(
    wall,
    FLOOR_CANVAS_W,
    FLOOR_CANVAS_H,
  )

  if (length < 2) return null

  return (
    <div
      className="floor-plan-wall pointer-events-none absolute"
      style={{
        left: x1,
        top: y1 - thicknessPx / 2,
        width: length,
        height: thicknessPx,
        transform: `rotateZ(${angleDeg}deg)`,
        transformOrigin: '0 50%',
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="floor-plan-wall__glow absolute inset-0"
        style={{ transform: `translateZ(${WALL_BODY_Z - 2}px)` }}
      />
      <div
        className="floor-plan-wall__body absolute left-0 right-0"
        style={{
          height,
          top: -height + thicknessPx,
          transform: `rotateX(-90deg)`,
          transformOrigin: 'bottom center',
        }}
      />
      <div
        className="floor-plan-wall__cap absolute inset-0"
        style={{ transform: `translateZ(${WALL_BODY_Z}px)` }}
      />
    </div>
  )
}
