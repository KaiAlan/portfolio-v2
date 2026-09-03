import Link from 'next/link'
import { listProjects } from '@/lib/preview'
import StatusPill from '@/components/admin/status-pill'

export default async function AdminProjectsPage() {
  const projects = await listProjects()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="type-body font-medium tracking-tight text-ink">
          Projects <span className="text-muted-soft">{projects.length}</span>
        </h1>
        <Link
          href="/admin/projects/new"
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink"
        >
          New project
        </Link>
      </header>

      <ul className="flex flex-col">
        {projects.map((project) => (
          <li key={project.id} className="border-b border-hairline">
            <Link
              href={`/admin/projects/${project.id}`}
              className="flex items-center gap-4 py-3"
            >
              {project.coverUrl ? (
                <img
                  src={project.coverUrl}
                  alt=""
                  width={40}
                  height={28}
                  className="h-7 w-10 rounded object-cover"
                />
              ) : (
                <span className="h-7 w-10 rounded bg-surface-warm" />
              )}
              <span className="type-body flex-1 text-ink">{project.title}</span>
              <span className="type-meta text-muted">{project.category}</span>
              <StatusPill state={project.state} />
            </Link>
          </li>
        ))}
      </ul>

      {projects.length === 0 && (
        <p className="type-body text-muted">Nothing here yet.</p>
      )}
    </div>
  )
}
