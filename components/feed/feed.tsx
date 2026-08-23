'use client'

import { LayoutGroup } from 'motion/react'
import { useMemo } from 'react'
import { useCategoryFilter } from '@/hooks/use-category-filter'
import { CATEGORIES, type Project } from '@/lib/types'
import FilterTabs from './filter-tabs'
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

  // Only offer filters that would actually return something.
  const available = useMemo(() => {
    const present = new Set(projects.map((p) => p.category))
    return CATEGORIES.filter((c) => present.has(c))
  }, [projects])

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
      <FilterTabs categories={available} active={active} onChange={setCategory} />

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
