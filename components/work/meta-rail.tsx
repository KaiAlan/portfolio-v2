import type { MetaRow, Project, SiteSettings } from '@/lib/types'

/**
 * Project metadata.
 *
 * A row renders only when it is enabled globally in siteSettings AND
 * non-empty on this project. One rule, both requirements: turning a row
 * off hides it everywhere, and a project that simply lacks a value never
 * shows an empty label.
 *
 * Layout is label-left / value-right separated by hairlines, which is what
 * lets a column of unrelated facts read as one table rather than a list.
 * Values are arrays so a multi-value row (tools, links) stacks on the right
 * instead of wrapping into an unreadable comma run.
 */

type MetaRailProps = {
  project: Project
  visibleMetaRows: SiteSettings['visibleMetaRows']
}

const MetaRail = ({ project, visibleMetaRows }: MetaRailProps) => {
  const enabled = new Set<MetaRow>(visibleMetaRows)

  const rows: { key: MetaRow; label: string; values: string[] }[] = [
    { key: 'year', label: 'Year', values: project.year ? [String(project.year)] : [] },
    { key: 'category', label: 'Category', values: [project.category] },
    { key: 'type', label: 'Type', values: project.type ? [project.type] : [] },
    { key: 'tools', label: 'Tools', values: project.tools },
    { key: 'client', label: 'Client', values: project.client ? [project.client] : [] },
  ]

  const visible = rows.filter((row) => enabled.has(row.key) && row.values.length > 0)
  const showLinks = enabled.has('links') && project.links.length > 0

  if (visible.length === 0 && !showLinks) return null

  return (
    <dl className="flex flex-col">
      {visible.map((row) => (
        <div
          key={row.key}
          className="flex items-start justify-between gap-6 border-b border-hairline py-2.5"
        >
          <dt className="type-meta shrink-0 text-muted">{row.label}</dt>
          <dd className="type-meta flex flex-col items-end text-right text-ink">
            {row.values.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </dd>
        </div>
      ))}

      {showLinks && (
        <div className="flex items-start justify-between gap-6 border-b border-hairline py-2.5">
          <dt className="type-meta shrink-0 text-muted">Links</dt>
          <dd className="type-meta flex flex-col items-end text-right">
            {project.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-ink underline underline-offset-4 hover:opacity-70"
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
