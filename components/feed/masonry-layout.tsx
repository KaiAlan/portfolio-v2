'use client'

import { type ReactNode } from 'react'
import { useElementWidth } from '@/hooks/use-element-width'
import { cn } from '@/lib/utils'

/**
 * Shortest-column masonry, positioned absolutely from known aspect ratios.
 *
 * CSS `columns` was rejected deliberately: it fills top-to-bottom per column,
 * so the reading order is wrong, and column boxes cannot be animated when the
 * filter changes. Because every shot carries width/height from Contentful, the
 * whole layout is computed before a single image byte arrives — no CLS.
 *
 * Before the container has been measured (server render, and the instant
 * before hydration) items render in a plain responsive grid instead of being
 * withheld, so every card and link is in the prerendered HTML for crawlers
 * and LCP. Measurement happens in useLayoutEffect, so that fallback is never
 * actually painted.
 */

export type MasonryItem = {
  id: string
  /** width / height */
  aspect: number
}

export type Placement = { left: number; top: number; width: number; height: number }

/** Gap between cards, on both axes. Scales with width so a wide screen reads
 *  as airy rather than as the same layout stretched wider. */
function gutterFor(width: number) {
  if (width < 600) return 16
  if (width < 1200) return 24
  return 32
}

/** Container width, NOT viewport — the page carries 72px of horizontal padding
 *  at lg, so the five-column jump intended at a 1560px viewport is written
 *  here as 1488px of container. */
function columnCount(width: number) {
  if (width < 600) return 1
  if (width < 900) return 2
  if (width < 1200) return 3
  if (width < 1488) return 4
  return 5
}

function computeLayout(items: MasonryItem[], width: number) {
  if (!width) return { placements: new Map<string, Placement>(), height: 0 }

  const columns = columnCount(width)
  const gutter = gutterFor(width)
  const columnWidth = (width - gutter * (columns - 1)) / columns
  const columnHeights = new Array<number>(columns).fill(0)
  const placements = new Map<string, Placement>()

  for (const item of items) {
    // Shortest column wins; ties go left, which keeps reading order sane.
    let target = 0
    for (let i = 1; i < columns; i++) {
      if (columnHeights[i] < columnHeights[target] - 0.5) target = i
    }

    const itemHeight = columnWidth / (item.aspect || 1)
    placements.set(item.id, {
      left: target * (columnWidth + gutter),
      top: columnHeights[target],
      width: columnWidth,
      height: itemHeight,
    })
    columnHeights[target] += itemHeight + gutter
  }

  return { placements, height: Math.max(...columnHeights, 0) - gutter }
}

type MasonryLayoutProps = {
  items: MasonryItem[]
  /** `placement` is null until the container has been measured. */
  renderItem: (item: MasonryItem, placement: Placement | null, index: number) => ReactNode
  className?: string
}

const MasonryLayout = ({ items, renderItem, className }: MasonryLayoutProps) => {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const { placements, height } = computeLayout(items, width)
  const measured = width > 0

  return (
    <div
      ref={ref}
      className={cn(
        'w-full',
        measured
          ? 'relative'
          : // Mirrors the measured layout's tiers and gutters so the handover
            // from fallback to masonry is not a visible jump.
            'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4 min-[1560px]:grid-cols-5',
        className,
      )}
      style={measured ? { height: height > 0 ? height : undefined } : undefined}
    >
      {items.map((item, index) => renderItem(item, placements.get(item.id) ?? null, index))}
    </div>
  )
}

export default MasonryLayout
