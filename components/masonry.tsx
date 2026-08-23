'use client'

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/**
 * Shortest-column masonry, positioned absolutely from known aspect ratios.
 *
 * CSS `columns` was rejected deliberately: it fills top-to-bottom per column,
 * so the reading order is wrong, and column boxes cannot be animated when the
 * filter changes. Because every shot carries width/height from Contentful, we
 * can compute the full layout before a single image byte arrives — no CLS.
 *
 * Before the container has been measured (server render, and the instant
 * before hydration) items render in a plain responsive grid instead of being
 * withheld. That keeps every card and its link in the prerendered HTML for
 * crawlers and LCP. Measurement happens in useLayoutEffect, so the fallback
 * is never actually painted.
 */

export type MasonryItem = {
  id: string
  /** width / height */
  aspect: number
}

export type Placement = { left: number; top: number; width: number; height: number }

const GUTTER = 16

function columnCount(width: number) {
  if (width < 560) return 2
  if (width < 900) return 3
  if (width < 1400) return 4
  return 5
}

export function Masonry({
  items,
  renderItem,
}: {
  items: MasonryItem[]
  /** `placement` is null until the container has been measured. */
  renderItem: (item: MasonryItem, placement: Placement | null, index: number) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    setWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0
      // Ignore sub-pixel jitter; relayout is cheap but not free.
      setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { placements, height } = useMemo(() => {
    if (!width) return { placements: new Map<string, Placement>(), height: 0 }

    const columns = columnCount(width)
    const columnWidth = (width - GUTTER * (columns - 1)) / columns
    const columnHeights = new Array<number>(columns).fill(0)
    const next = new Map<string, Placement>()

    for (const item of items) {
      // Shortest column wins; ties go left, which keeps reading order sane.
      let target = 0
      for (let i = 1; i < columns; i++) {
        if (columnHeights[i] < columnHeights[target] - 0.5) target = i
      }

      const itemHeight = columnWidth / (item.aspect || 1)
      next.set(item.id, {
        left: target * (columnWidth + GUTTER),
        top: columnHeights[target],
        width: columnWidth,
        height: itemHeight,
      })
      columnHeights[target] += itemHeight + GUTTER
    }

    return { placements: next, height: Math.max(...columnHeights, 0) - GUTTER }
  }, [items, width])

  const measured = width > 0

  return (
    <div
      ref={ref}
      className={
        measured
          ? 'relative w-full'
          : 'grid w-full grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4'
      }
      style={measured ? { height: height > 0 ? height : undefined } : undefined}
    >
      {items.map((item, index) => renderItem(item, placements.get(item.id) ?? null, index))}
    </div>
  )
}
