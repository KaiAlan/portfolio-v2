import { listProjects } from '@/lib/preview'
import ProjectsBoard from '@/components/admin/projects-board'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

export default async function AdminProjectsPage() {
  const projects = await listProjects()

  return <ProjectsBoard projects={projects} />
}
