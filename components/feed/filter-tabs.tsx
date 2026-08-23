'use client'

import { motion } from 'motion/react'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * Category tabs. The active state is a black pill that slides between
 * options via a shared layoutId rather than fading in place.
 */

type FilterTabsProps = {
  categories: readonly Category[]
  active: Category | null
  onChange: (next: Category | null) => void
}

const FilterTabs = ({ categories, active, onChange }: FilterTabsProps) => (
  <nav
    className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface p-1"
    aria-label="Filter by category"
  >
    <FilterTab label="All" active={active === null} onClick={() => onChange(null)} />
    {categories.map((category) => (
      <FilterTab
        key={category}
        label={category}
        active={active === category}
        onClick={() => onChange(category)}
      />
    ))}
  </nav>
)

type FilterTabProps = {
  label: string
  active: boolean
  onClick: () => void
}

const FilterTab = ({ label, active, onClick }: FilterTabProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="type-button relative rounded-pill px-4 py-2 transition-colors"
  >
    {active && (
      <motion.span
        layoutId="filter-pill"
        className="absolute inset-0 rounded-pill bg-ink"
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      />
    )}
    <span className={cn('relative', active ? 'text-on-dark' : 'text-muted hover:text-ink')}>
      {label}
    </span>
  </button>
)

export default FilterTabs
