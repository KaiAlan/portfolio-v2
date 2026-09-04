import type { ComponentProps } from 'react'

/**
 * The two feed-layout glyphs. Lucide (already the app's icon set) has
 * squares for "grid" but nothing for an uneven masonry layout, and the
 * design calls for four open circles rather than squares — so both are
 * small hand-drawn SVGs instead, kept to lucide's own conventions
 * (`viewBox="0 0 24 24"`, `strokeWidth="2"`, round caps/joins, no fill) so
 * they sit next to a lucide icon without looking imported from elsewhere.
 */

type IconProps = ComponentProps<'svg'>

/** Four uniform circles — grid mode, and the "All" category pill. */
export const GridCirclesIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <circle cx="7.5" cy="7.5" r="3.25" />
    <circle cx="16.5" cy="7.5" r="3.25" />
    <circle cx="7.5" cy="16.5" r="3.25" />
    <circle cx="16.5" cy="16.5" r="3.25" />
  </svg>
)

/** Stacked rules — the index view's numbered list. Uneven lengths so it
 *  reads as rows of text rather than as a hamburger menu. */
export const IndexListIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h11" />
  </svg>
)

/** Three uneven, top-aligned columns — masonry mode. Mirrors the shortest-
 *  column packing in `components/feed/masonry-layout.tsx`. */
export const MasonryIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <rect x="3" y="4" width="5" height="10" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="16" y="4" width="5" height="7" rx="1.5" />
  </svg>
)
