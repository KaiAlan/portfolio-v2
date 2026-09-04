'use client'

import { LayoutGroup } from 'motion/react'
import { useMemo } from 'react'
import CategoryLinks from '@/components/navbar/category-links'
import LayoutPicker from '@/components/ui/layout-picker'
import { useCategoryFilter } from '@/hooks/use-category-filter'
import { useFeedLayout } from '@/hooks/use-feed-layout'
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll'
import { FEED_COLUMN_CHOICES, FEED_FALLBACK, type FeedDefaults, type Project } from '@/lib/types'
import { cn } from '@/lib/utils'
import GridLayout from './grid-layout'
import IndexLayout from './index-layout'
import MasonryLayout, { type MasonryItem } from './masonry-layout'
import ProjectCard from './project-card'

/**
 * The feed.
 *
 * Filtering is client-side over the already-loaded list: the set is tens of
 * projects, not thousands, and a server round-trip would swap the DOM
 * instead of letting Motion animate the re-flow.
 *
 * `defaults` is the studio's Settings board — the layout a visitor sees
 * before they have chosen one of their own. It arrives from the server so it
 * is in the prerendered HTML, not applied after hydration.
 */

type FeedProps = {
  projects: Project[]
  defaults?: FeedDefaults
}

const Feed = ({ projects, defaults = FEED_FALLBACK }: FeedProps) => {
  const { active, setCategory } = useCategoryFilter()

  // Rebuilt only when a value actually changes. useFeedLayout memoises its
  // snapshot callbacks on this object's identity, so a fresh literal every
  // render would re-read the store every render.
  const stableDefaults = useMemo(
    () => ({ mode: defaults.mode, columns: defaults.columns }),
    [defaults.mode, defaults.columns],
  )

  const { mode, columns, setMode, setColumns } = useFeedLayout(stableDefaults)
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
      {/* Sticky directly beneath the header — at --nav-h, never a literal, so
          this cannot drift out of step with it again — and pulled full-bleed
          out of the page's padding so cards scroll under an opaque bar rather
          than past its edges. The tabs still line up with the first column.

          Hiding slides it up by its own height, which tucks it exactly behind
          the opaque z-50 header rather than moving it off-screen — so nothing
          reflows and the row reappears from under the header, not from the
          top of the viewport. */}
      <div
        className={cn(
          // top-(--nav-h), not a hardcoded top-16. The header is 72px and this
          // said 64, so the row pinned 8px too high and the z-50 header
          // painted over its top edge — which is why it looked clipped and
          // appeared to sit ON the cards rather than above them.
          'sticky top-(--nav-h) z-40 -mx-4 bg-canvas px-4 pt-2 pb-5 sm:-mx-6 sm:px-6 lg:-mx-9 lg:px-9',
          // Chrome docking, so it takes the slow step and the standard curve:
          // it moves in both directions and neither end is "arriving".
          'transition-transform duration-(--dur-slow) ease-(--ease-standard)',
          hidden && '-translate-y-full',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <CategoryLinks active={active} onChange={setCategory} />
          <LayoutPicker
            mode={mode}
            columns={columns}
            columnChoices={FEED_COLUMN_CHOICES}
            onModeChange={setMode}
            onColumnsChange={setColumns}
          />
        </div>
      </div>

      <LayoutGroup>
        {mode === 'index' ? (
          <IndexLayout
            projects={filtered}
            hrefFor={(project) => `/work/${project.slug}${query}`}
          />
        ) : mode === 'masonry' ? (
          <MasonryLayout
            items={items}
            renderItem={(item, placement, index) => {
              const project = byId.get(item.id)
              if (!project) return null
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="masonry"
                  placement={placement}
                  // Roughly the first viewport: fetch eagerly, lazy-load the rest.
                  priority={index < 8}
                  href={`/work/${project.slug}${query}`}
                />
              )
            }}
          />
        ) : (
          <GridLayout
            items={items}
            columns={columns}
            renderItem={(item, index) => {
              const project = byId.get(item.id)
              if (!project) return null
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  variant="grid"
                  placement={null}
                  priority={index < 8}
                  href={`/work/${project.slug}${query}`}
                />
              )
            }}
          />
        )}
      </LayoutGroup>

      {filtered.length === 0 && (
        <p className="type-body py-16 text-center text-muted">Nothing here yet.</p>
      )}
    </>
  )
}

export default Feed
