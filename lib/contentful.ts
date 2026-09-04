/** The only place the app talks to Contentful for reads.
 *
 *  Every fetch is `use cache` + tagged, so:
 *   - API calls stay near zero against the 100k/mo cap
 *   - admin mutations invalidate precisely, via updateTag/revalidateTag
 *   - a Contentful outage or bandwidth pause serves stale pages rather
 *     than a blank site
 */
import 'server-only'
import { createClient } from 'contentful'
import { cacheLife, cacheTag } from 'next/cache'
import {
  FEED_FALLBACK,
  META_ROWS,
  isFeedColumnChoice,
  isFeedMode,
  type MetaRow,
  type Project,
  type ProjectLink,
  type ShopItem,
  type Shot,
  type SiteSettings,
  type Category,
} from './types'

export const TAGS = {
  projects: 'projects',
  shop: 'shop',
  settings: 'settings',
} as const

function client() {
  const space = process.env.CONTENTFUL_SPACE_ID
  const accessToken = process.env.CONTENTFUL_DELIVERY_TOKEN
  if (!space || !accessToken) {
    throw new Error(
      'Missing CONTENTFUL_SPACE_ID / CONTENTFUL_DELIVERY_TOKEN. Copy .env.example to .env.local.',
    )
  }
  return createClient({
    space,
    accessToken,
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  }).withoutUnresolvableLinks
}

/* ------------------------------------------------------------------ *
 * Mappers — raw entries in, domain objects out.
 * Loosely typed on the way in: the SDK's deep generics buy little here,
 * and the content model is enforced by scripts/contentful-setup.mjs.
 * ------------------------------------------------------------------ */

type Raw = { sys: { id: string }; fields: Record<string, unknown> }

const str = (v: unknown) => (typeof v === 'string' && v.length ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function assetUrl(asset: unknown): string {
  const f = (asset as Raw | undefined)?.fields as { file?: { url?: string } } | undefined
  return f?.file?.url ?? ''
}

function toShot(entry: unknown): Shot | null {
  const e = entry as Raw | undefined
  if (!e?.sys?.id || !e.fields) return null

  const width = num(e.fields.width)
  const height = num(e.fields.height)
  const imageUrl = assetUrl(e.fields.image)

  // width/height/image are required upstream; a shot missing them would
  // collapse the masonry, so drop it rather than render a hole.
  if (!width || !height || !imageUrl) return null

  return {
    id: e.sys.id,
    kind: e.fields.kind === 'video' ? 'video' : 'image',
    imageUrl,
    videoMp4Url: str(e.fields.videoMp4Url),
    videoWebmUrl: str(e.fields.videoWebmUrl),
    width,
    height,
    caption: str(e.fields.caption),
  }
}

function toLinks(v: unknown): ProjectLink[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((raw) => {
    const item = raw as { label?: unknown; url?: unknown }
    const label = str(item?.label)
    const url = str(item?.url)
    return label && url ? [{ label, url }] : []
  })
}

function toProject(entry: unknown): Project | null {
  const e = entry as Raw | undefined
  if (!e?.sys?.id || !e.fields) return null

  const title = str(e.fields.title)
  const slug = str(e.fields.slug)
  const coverShot = toShot(e.fields.coverShot)

  // No cover means nothing to render in the grid.
  if (!title || !slug || !coverShot) return null

  const shots = Array.isArray(e.fields.shots)
    ? e.fields.shots.map(toShot).filter((s): s is Shot => s !== null)
    : []

  return {
    id: e.sys.id,
    title,
    slug,
    description: str(e.fields.description),
    category: (str(e.fields.category) ?? 'Creatives') as Category,
    tags: list(e.fields.tags),
    year: num(e.fields.year),
    type: str(e.fields.type),
    tools: list(e.fields.tools),
    client: str(e.fields.client),
    links: toLinks(e.fields.links),
    coverShot,
    // A single-shot project still has one entry here, so the detail view
    // has exactly one code path.
    shots: shots.length ? shots : [coverShot],
    featured: e.fields.featured === true,
  }
}

function toShopItem(entry: unknown): ShopItem | null {
  const e = entry as Raw | undefined
  if (!e?.sys?.id || !e.fields) return null

  const title = str(e.fields.title)
  const externalUrl = str(e.fields.externalUrl)
  const imageUrl = assetUrl(e.fields.image)
  if (!title || !externalUrl || !imageUrl) return null

  return {
    id: e.sys.id,
    title,
    description: str(e.fields.description),
    imageUrl,
    externalUrl,
    priceLabel: str(e.fields.priceLabel),
  }
}

/** Sort by an explicit ID array; anything not listed keeps its incoming
 *  (newest-first) position after the ordered items. */
function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

/* ------------------------------------------------------------------ *
 * Cached reads
 * ------------------------------------------------------------------ */

export async function getSiteSettings(): Promise<SiteSettings> {
  'use cache'
  cacheTag(TAGS.settings)
  cacheLife('days')

  const res = await client().getEntries({ content_type: 'siteSettings', limit: 1 })
  const fields = (res.items[0] as Raw | undefined)?.fields ?? {}

  return {
    projectOrder: list(fields.projectOrder),
    shopOrder: list(fields.shopOrder),
    visibleMetaRows: list(fields.visibleMetaRows).filter((r): r is MetaRow =>
      (META_ROWS as readonly string[]).includes(r),
    ),
    youtubePlaylistId: str(fields.youtubePlaylistId) ?? '',
    // Both fall back rather than validating loudly: an entry created before
    // these fields existed simply has neither, and the site should render
    // the way it always did rather than fail on a missing setting.
    feedDefaults: {
      mode: isFeedMode(fields.defaultFeedView) ? fields.defaultFeedView : FEED_FALLBACK.mode,
      columns: isFeedColumnChoice(fields.defaultFeedColumns)
        ? (fields.defaultFeedColumns as number)
        : FEED_FALLBACK.columns,
    },
  }
}

export async function getProjects(): Promise<Project[]> {
  'use cache'
  // Tagged with settings too: a reorder must invalidate this list.
  cacheTag(TAGS.projects, TAGS.settings)
  cacheLife('days')

  const [res, settings] = await Promise.all([
    client().getEntries({
      content_type: 'project',
      'fields.published': true,
      include: 2, // project -> shots -> image asset
      order: ['-sys.createdAt'],
      limit: 1000,
    }),
    getSiteSettings(),
  ])

  const projects = res.items.map(toProject).filter((p): p is Project => p !== null)
  return applyOrder(projects, settings.projectOrder)
}

export async function getProject(slug: string): Promise<Project | null> {
  'use cache'
  cacheTag(TAGS.projects)
  cacheLife('days')

  const res = await client().getEntries({
    content_type: 'project',
    'fields.slug': slug,
    'fields.published': true,
    include: 2,
    limit: 1,
  })

  return toProject(res.items[0]) ?? null
}

export async function getShopItems(): Promise<ShopItem[]> {
  'use cache'
  cacheTag(TAGS.shop, TAGS.settings)
  cacheLife('days')

  const [res, settings] = await Promise.all([
    client().getEntries({
      content_type: 'shopItem',
      'fields.published': true,
      order: ['-sys.createdAt'],
      limit: 200,
    }),
    getSiteSettings(),
  ])

  const items = res.items.map(toShopItem).filter((i): i is ShopItem => i !== null)
  return applyOrder(items, settings.shopOrder)
}
