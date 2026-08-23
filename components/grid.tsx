'use client'

import { LayoutGroup, motion } from 'motion/react'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { CATEGORIES, type Category, type Project } from '@/lib/types'
import { Masonry, type MasonryItem } from './masonry'
import { ProjectCard } from './project-card'

/**
 * The feed.
 *
 * Filtering is client-side over the already-loaded list: the full set is
 * tens of projects, not thousands, and a server round-trip would swap the
 * DOM instead of letting Motion animate the re-flow.
 *
 * The active filter lives in the URL so it stays shareable and the back
 * button works — but it is read from `window.location`, not through
 * useSearchParams. Reading search params would make this subtree dynamic,
 * and under Cache Components that ships the Suspense fallback as the
 * static shell, leaving the prerendered HTML with no cards in it at all.
 *
 * The URL is the single source of truth, so it is modelled as an external
 * store: `popstate` covers the back button, and `navigate` notifies
 * subscribers itself because pushState fires no event.
 */

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function getSnapshot(): Category | null {
  const value = new URLSearchParams(window.location.search).get('c')
  return CATEGORIES.includes(value as Category) ? (value as Category) : null
}

/** The server has no URL query to read, so it renders everything. */
const getServerSnapshot = (): Category | null => null

function navigate(next: Category | null) {
  const params = new URLSearchParams(window.location.search)
  if (next) params.set('c', next)
  else params.delete('c')
  const query = params.toString()
  // Natively supported by the App Router, and keeps this page static.
  window.history.pushState(null, '', query ? `/?${query}` : '/')
  listeners.forEach((notify) => notify())
}

export function Grid({ projects }: { projects: Project[] }) {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setCategory = useCallback((next: Category | null) => navigate(next), [])

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

  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter by category">
        <FilterChip label="All" active={active === null} onClick={() => setCategory(null)} />
        {available.map((category) => (
          <FilterChip
            key={category}
            label={category}
            active={active === category}
            onClick={() => setCategory(category)}
          />
        ))}
      </nav>

      <LayoutGroup>
        <Masonry
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
                priority={index < 6}
              />
            )
          }}
        />
      </LayoutGroup>

      {filtered.length === 0 && (
        <p className="py-16 text-center text-sm text-black/50">Nothing here yet.</p>
      )}
    </>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="relative rounded-full px-3 py-1.5 text-sm transition-colors"
    >
      {active && (
        <motion.span
          layoutId="filter-pill"
          className="absolute inset-0 rounded-full bg-black"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      <span className={`relative ${active ? 'text-white' : 'text-black/60 hover:text-black'}`}>
        {label}
      </span>
    </button>
  )
}
