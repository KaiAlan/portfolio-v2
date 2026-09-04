'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * The studio's top-level navigation, as one segmented control.
 *
 * Replaces the sidebar. A handful of destinations never justified a whole
 * column of chrome, and centring them puts the studio's own navigation on a
 * different axis from the site nav above it — so the two rows never read as
 * one bar.
 */

const TABS = [
  { href: '/admin', label: 'Projects', exact: true },
  { href: '/admin/order', label: 'Order', exact: false },
  { href: '/admin/shop', label: 'Shop', exact: false },
  { href: '/admin/settings', label: 'Settings', exact: false },
] as const

/**
 * Presentational half, taking the pathname rather than reading it — same split
 * as the site's primary links, so the Suspense fallback can render the real
 * tabs with no active state instead of a hole.
 */
export const StudioTabsList = ({ pathname }: { pathname: string | null }) => (
  <nav
    aria-label="Studio sections"
    className="inline-flex items-center gap-1 rounded-pill bg-control p-1.5"
  >
    {TABS.map((tab) => {
      // `/admin` is a prefix of every other tab, so the index one has to match
      // exactly or it stays lit on every one of them.
      const active = pathname
        ? tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        : false

      return (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'type-button rounded-pill px-7 py-2.5 transition-colors',
            active ? 'bg-ink text-on-dark' : 'text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      )
    })}
  </nav>
)

const StudioTabs = () => <StudioTabsList pathname={usePathname()} />

export default StudioTabs
