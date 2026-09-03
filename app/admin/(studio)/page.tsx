import { getSettingsEntry, listProjects } from '@/lib/preview'
import { applyOrder } from '@/lib/admin/order'
import ProjectsBoard from '@/components/admin/projects-board'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

export default async function AdminProjectsPage() {
  const [projects, settings] = await Promise.all([listProjects(), getSettingsEntry()])

  // The same order the feed serves and the Order board edits. listProjects()
  // returns newest-first, which made this board disagree with both — the
  // arrangement you just set was nowhere visible in the place you spend the
  // most time.
  //
  // Drafts are not in projectOrder, so applyOrder ranks them last, newest
  // first among themselves. That is the honest position: they have no place in
  // the feed's sequence yet, because they are not in the feed.
  const order = Array.isArray(settings?.fields.projectOrder)
    ? (settings.fields.projectOrder as string[])
    : []

  return <ProjectsBoard projects={applyOrder(projects, order)} />
}
