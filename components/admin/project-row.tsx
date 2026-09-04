import type { ReactNode } from 'react'
import type { AdminProject } from '@/lib/preview'
import { cn } from '@/lib/utils'
import StatusPill from './status-pill'

/**
 * One project as a row — the index view of either studio board.
 *
 * The counterpart to the site's own index view
 * (`components/feed/index-layout.tsx`), and the same trade: the list carries
 * the facts, and there is no cover competing for the space. So this is the
 * one view that shows *when* a project was last touched, which is the thing
 * a tile has no room for and which decides what an editor opens next.
 *
 * No hover preview, unlike the site's. There the cover is the point and the
 * list is a way to browse it; here the covers are one keystroke away in the
 * other two modes, and a box chasing the cursor over a board that is also a
 * drag surface would be in the way.
 *
 * Also the reorder view worth having: on the Order board the drop target is
 * an unambiguous gap between two rows, where a tile grid asks you to read
 * which side of a card the pointer is on.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** UTC getters, not `toLocaleDateString`. The rows are rendered on the
 *  server and hydrated on the client, and both a locale-dependent format and
 *  a local-timezone date can disagree between the two — which is a hydration
 *  mismatch over a date nobody reads to the day. */
const shortDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`
}

type ProjectRowProps = {
  project: AdminProject
  /** 1-based position, shown as /001 — the feed's own numbering. */
  position: number
  /** Rendered at the end of the row. The order board puts its grip here. */
  corner?: ReactNode
  showState?: boolean
}

const ProjectRow = ({ project, position, corner, showState = true }: ProjectRowProps) => (
  <div
    className={cn(
      // min-h-12 is the row-height floor. Three tracks on a phone, five once
      // there is room: category and date drop out rather than wrapping, since
      // a row that becomes two lines stops being a row.
      'grid min-h-12 grid-cols-[3.25rem_1fr_auto] items-center gap-4 px-3 py-3',
      'sm:grid-cols-[3.25rem_1fr_9rem_5rem_auto] sm:gap-6',
    )}
  >
    <span className="type-caption text-muted tabular-nums">
      /{String(position).padStart(3, '0')}
    </span>

    <div className="flex min-w-0 items-baseline gap-3">
      <span className="type-button truncate text-ink">{project.title}</span>
      {project.tags.length > 0 && (
        // Tags are the first thing to go: they are decoration next to the
        // four facts either side of them.
        <span className="type-meta hidden truncate text-muted-soft lg:block">
          {project.tags.map((tag) => `#${tag}`).join(' ')}
        </span>
      )}
    </div>

    <span className="type-caption hidden truncate text-muted sm:block">
      {project.category}
    </span>

    <span className="type-caption hidden text-muted tabular-nums sm:block">
      {shortDate(project.updatedAt)}
    </span>

    <div className="flex items-center justify-end gap-3">
      {showState && <StatusPill state={project.state} />}
      {corner}
    </div>
  </div>
)

export default ProjectRow
