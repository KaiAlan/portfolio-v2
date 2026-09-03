'use client'

import Link from 'next/link'
import type { AdminProject } from '@/lib/preview'
import BoardHeader from './board-header'
import ColumnPicker, { useBoardColumns } from './column-picker'
import ProjectCard, { ProjectGrid } from './project-card'

/**
 * The Projects board.
 *
 * A client component only because the column count is client state; the
 * projects themselves are still fetched on the server and passed in, so this
 * adds a control to the bundle and not a data fetch.
 */
const ProjectsBoard = ({ projects }: { projects: AdminProject[] }) => {
  const { columns, choose } = useBoardColumns()

  const count = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`

  return (
    <>
      <BoardHeader
        left={<span className="type-meta text-muted-soft">{count}</span>}
        right={
          <>
            <ColumnPicker columns={columns} onChange={choose} />
            <Link
              href="/admin/projects/new"
              className="type-button rounded-pill bg-ink px-5 py-2.5 whitespace-nowrap text-on-dark transition-opacity hover:opacity-90"
            >
              Add Project
            </Link>
          </>
        }
      />

      {projects.length === 0 ? (
        <p className="type-body py-16 text-center text-muted">
          Nothing here yet. Create a project and it will appear on this board.
        </p>
      ) : (
        <ProjectGrid columns={columns}>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/admin/projects/${project.id}`}
              className="rounded-card transition-opacity hover:opacity-80"
            >
              <ProjectCard project={project} />
            </Link>
          ))}
        </ProjectGrid>
      )}
    </>
  )
}

export default ProjectsBoard
