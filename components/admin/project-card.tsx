import type { CSSProperties, ReactNode } from 'react'
import type { AdminProject } from '@/lib/preview'
import { DEFAULT_COLUMNS } from './column-picker'
import StatusPill from './status-pill'

/**
 * One project as it appears on any studio board.
 *
 * Presentational and shared by both boards, so Projects and Order cannot drift
 * into two slightly different cards. What differs between them is passed in:
 * the order board puts a drag grip in `corner`, the projects board doesn't.
 *
 * The cover is *contained* on a tile rather than cropped to fill it. These are
 * shots of work at wildly different aspect ratios, and cropping them to a
 * uniform box is exactly the thing this portfolio's feed refuses to do — the
 * studio should show the same shot the site will.
 */

type ProjectCardProps = {
  project: AdminProject
  /** Rendered in the tile's top-right corner. */
  corner?: ReactNode
  /** Suppresses the status pill where publish state isn't the point. */
  showState?: boolean
}

const ProjectCard = ({ project, corner, showState = true }: ProjectCardProps) => (
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
            className="max-h-full max-w-full rounded-card object-contain shadow-float"
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

/** The board grid. Shared for the same reason the card is.
 *
 *  Uniform rows, never masonry: on a board the point is comparing and
 *  arranging covers, and ragged column bottoms make two cards at the same
 *  index look like they are at different ones. The feed masonries; this
 *  does not. */
export const ProjectGrid = ({
  columns = DEFAULT_COLUMNS,
  children,
}: {
  columns?: number
  children: ReactNode
}) => (
  <div
    className="board-grid gap-x-6 gap-y-8"
    style={{ '--board-cols': columns } as CSSProperties}
  >
    {children}
  </div>
)
