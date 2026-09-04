'use client'

import Link from 'next/link'
import { CATEGORIES, type Category } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GridCirclesIcon } from '@/components/ui/icons'

/**
 * The category filter row.
 *
 * Rendered by the feed, not the header: it belongs to the homepage alone, and
 * putting it here rather than in the root layout makes that true by
 * construction instead of by a pathname check. It also keeps `usePathname`
 * out of the header, which under Cache Components would force every route
 * that renders the nav to bail out of prerendering.
 *
 * The tabs are real links to `/?c=…`, so they survive a middle click and get
 * crawled — but the click is intercepted and swapped for a history.pushState,
 * which keeps this route static and lets Motion animate the masonry re-flow
 * instead of the router swapping the DOM out.
 *
 * Purely presentational: the feed owns the filter state, so there is exactly
 * one subscription to the URL rather than two that can disagree.
 */

type Item = { key: string; label: string; href: string; category: Category | null }

const ITEMS: Item[] = [
  { key: 'all', label: 'All', href: '/', category: null },
  ...CATEGORIES.map((category) => ({
    key: category,
    label: category,
    href: `/?c=${encodeURIComponent(category)}`,
    category,
  })),
]

type CategoryLinksProps = {
  active: Category | null
  onChange: (next: Category | null) => void
}

const CategoryLinks = ({ active, onChange }: CategoryLinksProps) => (
  <nav
    className="flex min-w-0 items-center gap-1 overflow-x-auto"
    aria-label="Filter by category"
  >
    {ITEMS.map((item) => {
      const current = active === item.category
      const isAll = item.category === null
      return (
        <Link
          key={item.key}
          href={item.href}
          aria-current={current ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            onChange(item.category)
          }}
          className={cn(
            // min-h-8 (32px): the button-height floor, not just py-1.5's
            // own height — type-button's line-height alone lands a hair
            // under 32px.
            'type-button inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 py-1.5 whitespace-nowrap transition-colors',
            current ? 'bg-ink text-on-dark' : 'bg-surface-alt text-muted hover:text-ink',
          )}
        >
          {isAll && <GridCirclesIcon className="size-3.5" />}
          {item.label}
        </Link>
      )
    })}
  </nav>
)

export default CategoryLinks
