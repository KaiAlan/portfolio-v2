import { notFound } from 'next/navigation'
import Lightbox from '@/components/work/lightbox'
import ProjectDetail from '@/components/work/project-detail'
import { getProject, getProjects, getSiteSettings } from '@/lib/contentful'
import { CATEGORIES, type Category } from '@/lib/types'

type ModalProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ c?: string }>
}

/**
 * `params`/`searchParams` are runtime data, and every field this panel shows
 * — title, shots, metadata — comes from the project keyed by `slug`. There is
 * no meaningful static shell to carry a navigation into this segment: the
 * alternative to blocking is a fallback panel with nothing real in it, which
 * is worse. `app/@modal/layout.tsx` holds a `<Suspense>` boundary above this
 * page so the shell doesn't remount and blink on every prev/next — that
 * boundary can't live here, because this file is keyed by [slug] and remounts
 * on every prev/next itself. `instant = false` stops Cache Components from
 * flagging the resulting blocking navigation as a problem to fix; the same
 * call already made for every `/admin` page — see the note in its `(studio)`
 * layout.
 */
export const instant = false

/**
 * The intercepted /work/[slug] — same ProjectDetail as the full page,
 * wrapped in the lightbox shell.
 *
 * prev/next are scoped to the filter the grid was showing, which arrives
 * as ?c= on the card's href. Browsing inside the lightbox therefore walks
 * the same set the user was actually looking at, not the whole catalogue.
 */
const WorkModal = async ({ params, searchParams }: ModalProps) => {
  const [{ slug }, { c }] = await Promise.all([params, searchParams])
  const [project, settings, all] = await Promise.all([
    getProject(slug),
    getSiteSettings(),
    getProjects(),
  ])

  if (!project) notFound()

  const category = CATEGORIES.includes(c as Category) ? (c as Category) : null
  const scoped = category ? all.filter((p) => p.category === category) : all
  const query = category ? `?c=${encodeURIComponent(category)}` : ''

  const index = scoped.findIndex((p) => p.slug === slug)
  const prev = index > 0 ? scoped[index - 1] : null
  const next = index >= 0 && index < scoped.length - 1 ? scoped[index + 1] : null

  return (
    <Lightbox
      prevHref={prev ? `/work/${prev.slug}${query}` : null}
      nextHref={next ? `/work/${next.slug}${query}` : null}
    >
      <ProjectDetail
        project={project}
        visibleMetaRows={settings.visibleMetaRows}
        variant="modal"
      />
    </Lightbox>
  )
}

export default WorkModal
