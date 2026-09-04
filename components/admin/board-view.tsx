'use client'

import { useMemo, type ReactNode } from 'react'
import MasonryLayout, { type MasonryItem } from '@/components/feed/masonry-layout'
import { GRID_CELL_ASPECT } from '@/lib/feed-layout'
import type { AdminProject } from '@/lib/preview'
import type { FeedMode } from '@/lib/types'
import { ProjectGrid } from './project-card'

/**
 * The three-mode container both studio boards render through.
 *
 * Projects and Order differ only in what wraps each project — a link on one,
 * a drag surface on the other — so the mode switch itself lives here rather
 * than being written out twice and drifting.
 *
 * Masonry reuses the SITE's `MasonryLayout` unchanged. It is pure geometry
 * over id + aspect, so there is nothing studio-specific to fork, and sharing
 * it means the board packs columns exactly the way the feed does. Note that
 * it picks its own column count from container width: masonry has no column
 * setting, which is why the picker greys the numbers out under it.
 *
 * `children` is a render prop, and in masonry mode what it returns is placed
 * inside an absolutely positioned box — so it has to fill that box (`h-full
 * w-full`) rather than size itself.
 */

/** A cover with no dimensions can't be packed, so it takes the grid's cell
 *  ratio and reads as a plain 4:3 tile among the ragged ones. Better than
 *  dropping the card: this is the studio, and an unfinished project is
 *  exactly what an editor came here to find. */
const FALLBACK_ASPECT = GRID_CELL_ASPECT

type BoardViewProps = {
  projects: AdminProject[]
  mode: FeedMode
  /** Grid mode only. */
  columns: number
  children: (project: AdminProject, index: number) => ReactNode
}

const BoardView = ({ projects, mode, columns, children }: BoardViewProps) => {
  const items: MasonryItem[] = useMemo(
    () => projects.map((p) => ({ id: p.id, aspect: p.coverAspect ?? FALLBACK_ASPECT })),
    [projects],
  )

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const indexOf = useMemo(
    () => new Map(projects.map((p, index) => [p.id, index])),
    [projects],
  )

  if (mode === 'index') {
    return (
      <ul className="w-full border-t border-hairline">
        {projects.map((project, index) => (
          <li key={project.id} className="border-b border-hairline">
            {children(project, index)}
          </li>
        ))}
      </ul>
    )
  }

  if (mode === 'masonry') {
    return (
      <MasonryLayout
        items={items}
        renderItem={(item, placement) => {
          const project = byId.get(item.id)
          if (!project) return null
          const index = indexOf.get(item.id) ?? 0

          // The positioning box, not the card: the card is presentational and
          // the drag wrapper the Order board puts around it needs to BE the
          // box it drops onto. Until MasonryLayout has measured itself it
          // renders its own fallback grid, so the box is a ratio in flow
          // rather than an absolute placement.
          return (
            <div
              key={item.id}
              className={placement ? 'absolute' : 'relative'}
              style={
                placement
                  ? {
                      left: placement.left,
                      top: placement.top,
                      width: placement.width,
                      height: placement.height,
                    }
                  : { aspectRatio: `${item.aspect}` }
              }
            >
              {children(project, index)}
            </div>
          )
        }}
      />
    )
  }

  return (
    <ProjectGrid columns={columns}>
      {projects.map((project, index) => children(project, index))}
    </ProjectGrid>
  )
}

export default BoardView
