'use client'

import Link from 'next/link'
import { useBoardLayout } from '@/hooks/use-board-layout'
import type { AdminProject } from '@/lib/preview'
import { BOARD_COLUMN_CHOICES } from '@/lib/types'
import { cn } from '@/lib/utils'
import LayoutPicker from '@/components/ui/layout-picker'
import { Button } from '@/components/ui/button'
import BoardHeader from './board-header'
import BoardView from './board-view'
import ProjectCard from './project-card'
import ProjectRow from './project-row'

/**
 * The Projects board.
 *
 * A client component only because the layout is client state; the projects
 * themselves are still fetched on the server and passed in, so this adds a
 * control to the bundle and not a data fetch.
 */
const ProjectsBoard = ({ projects }: { projects: AdminProject[] }) => {
  const { mode, columns, setMode, setColumns } = useBoardLayout()

  const count = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`

  return (
    <>
      <BoardHeader
        left={<span className="type-meta text-muted-soft">{count}</span>}
        right={
          <>
            <LayoutPicker
              mode={mode}
              columns={columns}
              columnChoices={BOARD_COLUMN_CHOICES}
              onModeChange={setMode}
              onColumnsChange={setColumns}
              tone="studio"
            />
            <Button asChild className="whitespace-nowrap">
              <Link href="/admin/projects/new">Add Project</Link>
            </Button>
          </>
        }
      />

      {projects.length === 0 ? (
        <p className="type-body py-16 text-center text-muted">
          Nothing here yet. Create a project and it will appear on this board.
        </p>
      ) : (
        <BoardView projects={projects} mode={mode} columns={columns}>
          {(project, index) => (
            <Link
              key={project.id}
              href={`/admin/projects/${project.id}`}
              className={cn(
                'block transition-colors',
                // A row highlights; a tile dims. Fading a full-bleed row to
                // 80% reads as it loading rather than as it being pointed at,
                // and inverting a tile would hide the cover it exists to show.
                mode === 'index'
                  ? 'hover:bg-surface-alt'
                  : 'h-full rounded-card transition-opacity hover:opacity-80',
              )}
            >
              {mode === 'index' ? (
                <ProjectRow project={project} position={index + 1} />
              ) : (
                <ProjectCard project={project} variant={mode} />
              )}
            </Link>
          )}
        </BoardView>
      )}
    </>
  )
}

export default ProjectsBoard
