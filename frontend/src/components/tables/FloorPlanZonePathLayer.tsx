import type { FloorPlanZonePath } from '../../lib/floorPlanLayout'
import { FLOOR_CANVAS_H, FLOOR_CANVAS_W } from '../../lib/floorPlanLayout'

export default function FloorPlanZonePathLayer({ paths }: { paths: FloorPlanZonePath[] }) {
  if (!paths.length) return null

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ transform: 'translateZ(3px)', transformStyle: 'preserve-3d' }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${FLOOR_CANVAS_W} ${FLOOR_CANVAS_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {paths.map(path => {
          const d = path.points
            .map((p, i) => {
              const x = (p.x / 100) * FLOOR_CANVAS_W
              const y = (p.y / 100) * FLOOR_CANVAS_H
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
            })
            .join(' ')
          return (
            <path
              key={path.id}
              d={d}
              fill="none"
              stroke="rgba(212, 175, 55, 0.55)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="floor-plan-zone-path"
            />
          )
        })}
      </svg>
    </div>
  )
}
