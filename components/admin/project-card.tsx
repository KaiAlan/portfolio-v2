import type { CSSProperties, ReactNode } from 'react'
import type { AdminProject } from '@/lib/preview'
import { BOARD_FALLBACK } from '@/lib/types'
import { cn } from '@/lib/utils'
import StatusPill from './status-pill'

/**
 * One project as a tile on any studio board.
 *
 * Presentational and shared by both boards, so Projects and Order cannot
 * drift into two slightly different cards. What differs between them is
 * passed in: the order board puts a drag grip in `corner`, the projects
 * board doesn't.
 *
 * `variant` mirrors the site's own card (`components/feed/project-card.tsx`),
 * because the studio should show the work in the shape the site will:
 *
 *   grid    -> a fixed 4:3 tile with the cover *contained* inside it, so the
 *              tile's ground shows as a border around anything that isn't
 *              4:3. Uniform rows are what make two cards at the same index
 *              look like it, which is why this is what a board opens on.
 *   masonry -> the tile IS the cover's own aspect ratio — BoardView sizes
 *              the box from MasonryLayout's shortest-column packing, and
 *              this card just fills it edge to edge. A meta row UNDER a
 *              masonry tile would have to be packed for as well, so the
 *              title and state ride ON the tile instead — one rectangle per
 *              card, and the gaps stay gaps.
 *
 * The index view is a row, not a tile, and lives in `project-row.tsx`.
 */

type ProjectCardProps = {
  project: AdminProject
  variant?: 'grid' | 'masonry'
  /** Rendered in the tile's top-right corner. */
  corner?: ReactNode
  /** Suppresses the status pill where publish state isn't the point. */
  showState?: boolean
}

const ProjectCard = ({
  project,
  variant = 'grid',
  corner,
  showState = true,
}: ProjectCardProps) =>
  variant === 'masonry' ? (
    // h-full, because the positioning box is the one BoardView renders from
    // the placement — this card just fills it.
    <article className="group relative h-full w-full overflow-hidden rounded-card border border-card-edge bg-surface-alt">
      {project.coverUrl ? (
        // object-cover crops nothing: the box it fills was sized from this
        // cover's own ratio. It only bites for a cover missing dimensions,
        // where BoardView falls back to 4:3 and there is no right answer.
        <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="type-meta absolute inset-0 grid place-items-center text-muted-soft">
          No cover
        </span>
      )}

      {/* Always visible, not hover-revealed like the site's. A board is a
          working surface: scanning it for a title should not require
          pointing at every tile in turn. Flat label on the canvas ground —
          it reads clearly over light and dark artwork alike, which a
          gradient wash does not. */}
      <p className="type-caption absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-card bg-canvas px-2.5 py-1 text-ink">
        {project.title}
      </p>

      {showState && (
        <div className="absolute top-2.5 left-2.5">
          <StatusPill state={project.state} />
        </div>
      )}

      {corner && <div className="absolute top-3 right-3">{corner}</div>}
    </article>
  ) : (
    <article className="flex flex-col">
      <div className="relative aspect-4/3 rounded-card bg-surface-alt">
        {/* The image sits in an absolutely positioned box, and that is load
            bearing. `aspect-ratio` only sets a *preferred* size: with the image
            in normal flow, `max-h-full` has no definite parent height to resolve
            against, so a tall cover pushed the tile past the ratio and the board
            came out ragged instead of gridded. Taking the box out of flow gives
            it a definite height and puts the ratio back in charge. */}
        <div className="absolute inset-[12%] flex items-center justify-center">
          {project.coverUrl ? (
            <img
              src={project.coverUrl}
              alt=""
              // No shadow. On the site a cover floats above the canvas, but here the
              // tile behind it is already a distinct surface, so a second lift
              // just adds a grey halo between the artwork and its own frame.
              className="max-h-full max-w-full rounded-card object-contain"
            />
          ) : (
            <span className="type-meta text-muted-soft">No cover</span>
          )}
        </div>

        {corner && <div className="absolute top-3 right-3">{corner}</div>}
      </div>

      <div className="flex items-start justify-between gap-3 pt-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="type-body truncate tracking-tight text-ink">{project.title}</h3>
          {project.tags.length > 0 && (
            <p className="type-meta truncate text-muted-soft">
              {project.tags.map((tag) => `#${tag}`).join(' ')}
            </p>
          )}
        </div>

        {showState && (
          <div className="shrink-0 pt-0.5">
            <StatusPill state={project.state} />
          </div>
        )}
      </div>
    </article>
  )

export default ProjectCard

/** The board's uniform grid — grid mode only; the other two modes bring
 *  their own container (see `board-view.tsx`). Shared for the same reason
 *  the card is. */
export const ProjectGrid = ({
  columns = BOARD_FALLBACK.columns,
  className,
  children,
}: {
  columns?: number
  className?: string
  children: ReactNode
}) => (
  <div
    className={cn('board-grid gap-x-6 gap-y-8', className)}
    style={{ '--board-cols': columns } as CSSProperties}
  >
    {children}
  </div>
)
