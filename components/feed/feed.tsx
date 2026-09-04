'use client'

import { LayoutGroup } from 'motion/react'
import { useMemo } from 'react'
import CategoryLinks from '@/components/navbar/category-links'
import { useCategoryFilter } from '@/hooks/use-category-filter'
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll'
import type { Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import MasonryLayout, { type MasonryItem } from './masonry-layout'
import ProjectCard from './project-card'

/**
 * The feed.
 *
 * Filtering is client-side over the already-loaded list: the set is tens of
 * projects, not thousands, and a server round-trip would swap the DOM
 * instead of letting Motion animate the re-flow.
 */

type FeedProps = {
  projects: Project[]
}

const Feed = ({ projects }: FeedProps) => {
  const { active, setCategory } = useCategoryFilter()
  const hidden = useHideOnScroll()

  const filtered = useMemo(
    () => (active ? projects.filter((p) => p.category === active) : projects),
    [projects, active],
  )

  const items: MasonryItem[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        aspect: p.coverShot.width / p.coverShot.height,
      })),
    [filtered],
  )

  const byId = useMemo(() => new Map(filtered.map((p) => [p.id, p])), [filtered])

  // The lightbox reads this to scope prev/next to what is on screen.
  const query = active ? `?c=${encodeURIComponent(active)}` : ''

  return (
    <>
      {/* Sticky directly beneath the 64px header, and pulled full-bleed out of
          the page's padding so cards scroll under an opaque bar rather than
          past its edges. The tabs still line up with the first column.

          Hiding slides it up by its own height, which tucks it exactly behind
          the opaque z-50 header rather than moving it off-screen — so nothing
          reflows and the row reappears from under the header, not from the
          top of the viewport. */}
      <div
        className={cn(
          // Chrome docking, so it takes the slow step and the standard curve:
          // it moves in both directions and neither end is "arriving".
          'sticky top-16 z-40 -mx-4 bg-canvas px-4 pt-1 pb-5 transition-transform duration-(--dur-slow) ease-(--ease-standard) sm:-mx-6 sm:px-6 lg:-mx-9 lg:px-9',
          hidden && '-translate-y-full',
        )}
      >
        <CategoryLinks active={active} onChange={setCategory} />
      </div>

      <LayoutGroup>
        <MasonryLayout
          items={items}
          renderItem={(item, placement, index) => {
            const project = byId.get(item.id)
            if (!project) return null
            return (
              <ProjectCard
                key={project.id}
                project={project}
                placement={placement}
                // Roughly the first viewport: fetch eagerly, lazy-load the rest.
                priority={index < 8}
                href={`/work/${project.slug}${query}`}
              />
            )
          }}
        />
      </LayoutGroup>

      {filtered.length === 0 && (
        <p className="type-body py-16 text-center text-muted">Nothing here yet.</p>
      )}
    </>
  )
}

export default Feed
