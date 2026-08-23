import type { MetaRow, Project, SiteSettings } from '@/lib/types'

/**
 * Project metadata.
 *
 * A row renders only when it is enabled globally in siteSettings AND
 * non-empty on this project. One rule, both requirements: turning a row
 * off hides it everywhere, and a project that simply lacks a value never
 * shows an empty label.
 */

type MetaRailProps = {
  project: Project
  visibleMetaRows: SiteSettings['visibleMetaRows']
}

const MetaRail = ({ project, visibleMetaRows }: MetaRailProps) => {
  const enabled = new Set<MetaRow>(visibleMetaRows)

  const rows: { key: MetaRow; label: string; value: string | null }[] = [
    { key: 'year', label: 'Year', value: project.year ? String(project.year) : null },
    { key: 'category', label: 'Category', value: project.category },
    { key: 'type', label: 'Type', value: project.type ?? null },
    { key: 'tools', label: 'Tools', value: project.tools.length ? project.tools.join(', ') : null },
    { key: 'client', label: 'Client', value: project.client ?? null },
  ]

  const visible = rows.filter((row) => enabled.has(row.key) && row.value)
  const showLinks = enabled.has('links') && project.links.length > 0

  if (visible.length === 0 && !showLinks) return null

  return (
    <dl className="flex flex-col gap-3">
      {visible.map((row) => (
        <div key={row.key} className="flex gap-4">
          <dt className="type-meta w-20 shrink-0 text-muted">{row.label}</dt>
          <dd className="type-meta text-ink">{row.value}</dd>
        </div>
      ))}

      {showLinks && (
        <div className="flex gap-4">
          <dt className="type-meta w-20 shrink-0 text-muted">Links</dt>
          <dd className="flex flex-wrap gap-x-4 gap-y-1">
            {project.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="type-meta text-ink underline underline-offset-4 hover:opacity-70"
              >
                {link.label}
              </a>
            ))}
          </dd>
        </div>
      )}
    </dl>
  )
}

export default MetaRail
