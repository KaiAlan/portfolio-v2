import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import ProjectForm, { type ProjectFormValues } from '@/components/admin/project-form'
import DropZone from '@/components/admin/drop-zone'
import ShotCanvas from '@/components/admin/shot-canvas'
import { coverShotId, getRawProject, shotsOf } from '@/lib/preview'
import { publishState } from '@/lib/admin/publish-state'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

const EMPTY: ProjectFormValues = {
  id: 'new', title: '', slug: '', description: '', category: '',
  tags: '', year: '', type: '', tools: '', client: '', featured: false,
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const csv = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '')

const BackLink = () => (
  /* /admin, not /admin/projects — the projects board is the studio's index
     route; there is no page at /admin/projects, only /admin/projects/[id]. */
  <Link
    href="/admin"
    aria-label="Back to projects"
    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-warm text-ink transition-opacity hover:opacity-80"
  >
    <ChevronLeft size={18} />
  </Link>
)

export default async function ProjectEditPage({ params }: PageProps<'/admin/projects/[id]'>) {
  const { id } = await params

  if (id === 'new') {
    // One column on purpose: there is nothing to attach shots to until this
    // has been saved, so the canvas and the drop zone would both be dead.
    return (
      <div className="flex max-w-xl flex-col gap-6 pt-6">
        <div className="flex items-center gap-3">
          <BackLink />
          <h1 className="type-body font-medium tracking-tight text-ink">New project</h1>
        </div>
        <ProjectForm values={EMPTY} state="draft" />
      </div>
    )
  }

  const entry = await getRawProject(id)
  if (!entry) notFound()

  const shots = shotsOf(entry)
  const state = publishState(entry.sys)

  const values: ProjectFormValues = {
    id,
    title: str(entry.fields.title),
    slug: str(entry.fields.slug),
    description: str(entry.fields.description),
    category: str(entry.fields.category),
    tags: csv(entry.fields.tags),
    year: typeof entry.fields.year === 'number' ? String(entry.fields.year) : '',
    type: str(entry.fields.type),
    tools: csv(entry.fields.tools),
    client: str(entry.fields.client),
    featured: entry.fields.featured === true,
  }

  return (
    /* `main` deliberately has no top padding — the boards' pinned headers
       supply their own. This page has no pinned header, so it supplies it here;
       without it the title sits flush against the panel's nav rule. */
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex items-center gap-3">
        <BackLink />
        <h1 className="type-body truncate font-medium tracking-tight text-ink">{values.title}</h1>
      </div>

      {/* The work on the left, the controls on the right. A fixed right track
          rather than a fraction: the form's inputs stop being readable much
          past this width, and letting them stretch on a wide monitor would
          take space away from the shot you are actually judging. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
        <ShotCanvas
          // Keyed on the shot ids so a drop-zone attach remounts it with the
          // new list rather than leaving its local state behind.
          key={shots.map((s) => s.id).join(',')}
          projectId={id}
          shots={shots}
          coverId={coverShotId(entry)}
          state={state}
        />

        <div className="flex flex-col gap-6">
          <DropZone projectId={id} />
          <ProjectForm values={values} state={state} />
        </div>
      </div>
    </div>
  )
}
