import { notFound } from 'next/navigation'
import ProjectForm, { type ProjectFormValues } from '@/components/admin/project-form'
import DropZone from '@/components/admin/drop-zone'
import { getRawProject } from '@/lib/preview'
import { publishState } from '@/lib/admin/publish-state'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

const EMPTY: ProjectFormValues = {
  id: 'new', title: '', slug: '', description: '', category: '',
  tags: '', year: '', type: '', tools: '', client: '', featured: false,
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const csv = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '')

export default async function ProjectEditPage({ params }: PageProps<'/admin/projects/[id]'>) {
  const { id } = await params

  if (id === 'new') {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="type-body font-medium tracking-tight text-ink">New project</h1>
        <ProjectForm values={EMPTY} state="draft" />
      </div>
    )
  }

  const entry = await getRawProject(id)
  if (!entry) notFound()

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
    <div className="flex flex-col gap-6">
      <h1 className="type-body font-medium tracking-tight text-ink">{values.title}</h1>
      <ProjectForm values={values} state={publishState(entry.sys)} />
      {/* Only for a saved project: shots need something to attach to. */}
      <DropZone projectId={id} />
    </div>
  )
}
