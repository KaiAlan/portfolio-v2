import { notFound } from 'next/navigation'
import ProjectEditor from '@/components/admin/project-editor'
import type { ProjectFormValues } from '@/components/admin/project-fields'
import { coverShotId, getRawProject, shotsOf } from '@/lib/preview'
import { visibleState } from '@/lib/admin/publish-state'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

const EMPTY: ProjectFormValues = {
  id: 'new', title: '', slug: '', description: '', category: '',
  tags: '', year: '', type: '', tools: '', client: '', featured: false,
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const csv = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '')

/** Reads; ProjectEditor decides. Everything below the fetch is one client
 *  component because the header's Save/Publish buttons and the form's inputs
 *  have to share state — see the note there. */
export default async function ProjectEditPage({ params }: PageProps<'/admin/projects/[id]'>) {
  const { id } = await params

  if (id === 'new') {
    return <ProjectEditor values={EMPTY} state="draft" shots={[]} />
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
    <ProjectEditor
      values={values}
      // visibleState, not publishState: unpublishProject leaves the entry
      // published in Contentful and only flips `fields.published`, so
      // publishState would report a hidden project as 'live' — and the editor
      // would keep offering Unpublish while hiding Delete.
      state={visibleState(entry.sys, entry.fields.published === true)}
      shots={shotsOf(entry)}
      coverId={coverShotId(entry)}
    />
  )
}
