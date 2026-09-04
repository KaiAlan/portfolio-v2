'use client'

import { type CSSProperties, type ReactNode } from 'react'

/**
 * The uniform-column alternative to `MasonryLayout`.
 *
 * Every cell is the same square, set with `.feed-grid`'s `--feed-cols`
 * (`app/globals.css`) — a CSS custom property, not a Tailwind class, because
 * the column count is a runtime user choice and nothing would exist to
 * generate a utility for it at build time. Same trick the studio's
 * `.board-grid` already uses for the same reason.
 *
 * No measurement, no absolute positioning: CSS grid sizes every cell itself,
 * so unlike `MasonryLayout` there is no unmeasured-fallback frame to worry
 * about. `renderItem` gets just the item and its index — the per-item sizing
 * `MasonryLayout` computes as a `Placement` has no equivalent here, since
 * every cell is identical; the shot's own contained box is worked out inside
 * the card itself (`lib/feed-layout.ts`).
 */

export type GridItem = { id: string }

type GridLayoutProps<T extends GridItem> = {
  items: T[]
  columns: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

const GridLayout = <T extends GridItem>({
  items,
  columns,
  renderItem,
  className,
}: GridLayoutProps<T>) => (
  <div
    className={`feed-grid w-full gap-4 sm:gap-6 lg:gap-8 ${className ?? ''}`}
    style={{ '--feed-cols': columns } as CSSProperties}
  >
    {items.map((item, index) => renderItem(item, index))}
  </div>
)

export default GridLayout
