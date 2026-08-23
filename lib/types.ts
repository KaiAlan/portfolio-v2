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

export type SiteSettings = {
  /** Entry IDs, in display order. Empty = fall back to newest-first. */
  projectOrder: string[]
  shopOrder: string[]
  visibleMetaRows: MetaRow[]
}
