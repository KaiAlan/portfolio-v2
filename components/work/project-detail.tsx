import type { Project, SiteSettings } from '@/lib/types'
import { cn } from '@/lib/utils'
import MetaRail from './meta-rail'
import ShotMedia from './shot-media'

/**
 * The project view.
 *
 * Deliberately presentational and route-agnostic: the same component
 * renders the full page at /work/[slug] and the lightbox opened from the
 * grid, so the two can never drift apart.
 */

type ProjectDetailProps = {
  project: Project
  visibleMetaRows: SiteSettings['visibleMetaRows']
  /** The lightbox scrolls inside itself and needs tighter padding. */
  variant?: 'page' | 'modal'
}

const ProjectDetail = ({ project, visibleMetaRows, variant = 'page' }: ProjectDetailProps) => (
  <article
    className={cn(
      'mx-auto flex w-full max-w-5xl flex-col gap-8',
      variant === 'page' ? 'px-4 py-10 sm:px-6' : 'p-4 sm:p-6',
    )}
  >
    <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="type-display-lg">{project.title}</h1>
        {project.description && <p className="type-body text-muted">{project.description}</p>}
      </div>
      <MetaRail project={project} visibleMetaRows={visibleMetaRows} />
    </header>

    <div className="flex flex-col gap-4">
      {project.shots.map((shot, index) => (
        <figure key={shot.id} className="flex flex-col gap-2">
          <ShotMedia
            shot={shot}
            priority={index === 0}
            sizes={variant === 'page' ? '(max-width: 1024px) 100vw, 1024px' : '90vw'}
          />
          {shot.caption && !shot.caption.startsWith('[test]') && (
            <figcaption className="type-meta text-muted">{shot.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  </article>
)

export default ProjectDetail
