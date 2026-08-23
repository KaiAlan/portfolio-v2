'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Work' },
  { href: '/shop', label: 'Shop' },
] as const

const isActive = (pathname: string | null, href: string) => {
  if (!pathname) return false
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

/**
 * Presentational half. Takes the pathname rather than reading it, so the
 * Suspense fallback can render the same links with no active state — the
 * nav is therefore always present in the prerendered HTML.
 */
export const NavLinksList = ({ pathname }: { pathname: string | null }) => (
  <nav className="flex items-center gap-1" aria-label="Primary">
    {LINKS.map((link) => {
      const active = isActive(pathname, link.href)
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
 * usePathname is a dynamic API under Cache Components, so this must sit
 * behind a Suspense boundary or it forces every route that renders the
 * header to bail out of prerendering.
 */
const NavLinks = () => <NavLinksList pathname={usePathname()} />

export default NavLinks
