/** Domain types. Deliberately decoupled from Contentful's entry shape —
 *  components never see `fields`/`sys`, and swapping the CMS stays a
 *  one-file change in lib/contentful.ts. */

export const CATEGORIES = [
  'Product design',
  'Graphics & Socials',
  'Creatives',
  'Framer',
] as const

export type Category = (typeof CATEGORIES)[number]

export const META_ROWS = ['year', 'category', 'type', 'tools', 'client', 'links'] as const
export type MetaRow = (typeof META_ROWS)[number]

export type Shot = {
  id: string
  kind: 'image' | 'video'
  /** For kind='video' this is the poster frame. */
  imageUrl: string
  videoMp4Url?: string
  videoWebmUrl?: string
  /** Mandatory upstream — drives masonry with zero CLS. */
  width: number
  height: number
  caption?: string
}

export type ProjectLink = { label: string; url: string }

export type Project = {
  id: string
  title: string
  slug: string
  description?: string
  category: Category
  tags: string[]
  year?: number
  type?: string
  tools: string[]
  client?: string
  links: ProjectLink[]
  coverShot: Shot
  shots: Shot[]
  /** Autoplays in the grid instead of playing on hover. */
  featured: boolean
}

export type ShopItem = {
  id: string
  title: string
  description?: string
  imageUrl: string
  externalUrl: string
  priceLabel?: string
}

/* ------------------------------------------------------------------ *
 * Feed layout
 *
 * Here rather than in the hook that reads it (`hooks/use-feed-layout.ts`)
 * because both sides need these: the hook is a client module, while the
 * Contentful mapper, the studio's form and the server action are all
 * server code and must not import a `'use client'` file to get a type.
 * ------------------------------------------------------------------ */

export const FEED_MODES = ['masonry', 'grid', 'index'] as const
export type FeedMode = (typeof FEED_MODES)[number]

/** Column counts the grid offers. Grid only — masonry packs to its own
 *  width-driven tiers and the index view is a single column by definition. */
export const FEED_COLUMN_CHOICES = [2, 3, 4, 5, 6] as const

export const isFeedMode = (value: unknown): value is FeedMode =>
  typeof value === 'string' && (FEED_MODES as readonly string[]).includes(value)

export const isFeedColumnChoice = (value: unknown): value is number =>
  typeof value === 'number' && (FEED_COLUMN_CHOICES as readonly number[]).includes(value)

/** A layout mode paired with a column count — everything the layout picker
 *  holds. Named for the feed below because that is where it was designed;
 *  the studio's boards store the same pair. */
export type LayoutChoice = { mode: FeedMode; columns: number }

/** What a visitor with no stored preference sees. Overridable per browser
 *  once they touch the feed's own layout picker. */
export type FeedDefaults = LayoutChoice

export const FEED_FALLBACK: FeedDefaults = { mode: 'masonry', columns: 3 }

/* ------------------------------------------------------------------ *
 * Studio boards
 *
 * The Projects and Order boards offer the same three modes as the feed, so
 * an editor arranges the work in the shape they will actually see it in.
 * What differs is the column range: scanning thirty covers wants eight,
 * comparing two crops wants one — wider than the feed, where a 6-up of
 * finished work is already the dense end.
 *
 * Here rather than in `hooks/use-board-layout.ts` for the same reason the
 * feed's constants are: the board grid is rendered by a server component
 * (`components/admin/project-card.tsx`), which must not import a
 * `'use client'` module to get a default.
 * ------------------------------------------------------------------ */

export const BOARD_COLUMN_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8] as const

export const isBoardColumnChoice = (value: unknown): value is number =>
  typeof value === 'number' && (BOARD_COLUMN_CHOICES as readonly number[]).includes(value)

/** Grid, not masonry: a board is for comparing and arranging covers, and
 *  uniform rows are what make two cards at the same index look like it.
 *  Masonry is now available — it is just not the thing to open on. */
export const BOARD_FALLBACK: LayoutChoice = { mode: 'grid', columns: 3 }

export type SiteSettings = {
  /** Entry IDs, in display order. Empty = fall back to newest-first. */
  projectOrder: string[]
  shopOrder: string[]
  visibleMetaRows: MetaRow[]
  /** YouTube playlist behind the nav player. Empty = no player at all. */
  youtubePlaylistId: string
  /** The feed's starting layout, set in the studio's Settings board. */
  feedDefaults: FeedDefaults
}
