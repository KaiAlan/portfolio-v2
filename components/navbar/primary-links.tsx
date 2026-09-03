'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Page navigation — the header's first row, beside the name.
 *
 * Separate from the category row because these are destinations, not filters:
 * they change the page, never the feed's contents.
 */

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/shop', label: 'Shop' },
] as const

/**
 * Presentational half. Takes the pathname rather than reading it, so the
 * Suspense fallback can render the same links with no active state — the nav
 * is therefore always present in the prerendered HTML.
 */
export const PrimaryLinksList = ({ pathname }: { pathname: string | null }) => (
  <nav className="flex items-center gap-1" aria-label="Primary">
    {LINKS.map((link) => {
      const active = pathname?.startsWith(link.href) ?? false
      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'type-button rounded-pill px-3 py-2 transition-colors',
            active ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {link.label}
        </Link>
      )
    })}
  </nav>
)

/**
 * usePathname is a dynamic API under Cache Components, so this must sit behind
 * a Suspense boundary or it forces every route that renders the header to bail
 * out of prerendering.
 */
const PrimaryLinks = () => <PrimaryLinksList pathname={usePathname()} />

export default PrimaryLinks
