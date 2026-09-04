import { getSettingsEntry, listProjects } from '@/lib/preview'
import { boardOrder } from '@/lib/admin/order'
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
  // Drafts lead, newest first; everything published keeps exactly the feed's
  // sequence. They used to rank LAST, because they are not in projectOrder and
  // applyOrder sends unlisted ids to the end — which meant a project you had
  // just created landed below thirty you were not working on. See boardOrder
  // for why this does not put the board out of step with the site.
  const order = Array.isArray(settings?.fields.projectOrder)
    ? (settings.fields.projectOrder as string[])
    : []

  return <ProjectsBoard projects={boardOrder(projects, order)} />
}
