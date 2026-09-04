/** Studio reads. Separate from lib/contentful.ts on purpose:
 *   - preview host, so DRAFTS are visible
 *   - uncached, because editing against stale data is editing against a lie
 *  lib/contentful.ts is never modified; the public site keeps its own path.
 */
import 'server-only'
import { createClient } from 'contentful'
import { visibleState, type VisibleState } from './admin/publish-state'
import { imageUrl } from './media'

export type RawEntry = {
  sys: {
    id: string
    revision: number
    updatedAt: string
    publishedAt?: string
    publishedVersion?: number
  }
  fields: Record<string, unknown>
}

export type AdminProject = {
  id: string
  title: string
  slug: string
  category: string
  tags: string[]
  /** What the studio should SAY — includes 'hidden', which publishState
   *  cannot express. See visibleState. */
  state: VisibleState
  /** `fields.published`: whether the SITE renders it. Distinct from whether
   *  the entry is published in Contentful. */
  published: boolean
  coverUrl?: string
  updatedAt: string
}

function previewClient() {
  const space = process.env.CONTENTFUL_SPACE_ID
  const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN
  if (!space || !accessToken) {
    throw new Error('Missing CONTENTFUL_SPACE_ID / CONTENTFUL_PREVIEW_TOKEN.')
  }
  return createClient({
    space,
    accessToken,
    host: 'preview.contentful.com',
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  }).withoutUnresolvableLinks
}

function coverUrlOf(fields: Record<string, unknown>): string | undefined {
  const cover = fields.coverShot as { fields?: { image?: { fields?: { file?: { url?: string } } } } } | undefined
  const rawUrl = cover?.fields?.image?.fields?.file?.url
  return rawUrl ? imageUrl(rawUrl, 400) : undefined
}

export async function listProjects(): Promise<AdminProject[]> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    include: 2,
    order: ['-sys.updatedAt'],
    limit: 1000,
  })

  return res.items.map((item) => {
    const e = item as unknown as RawEntry
    return {
      id: e.sys.id,
      title: (e.fields.title as string) ?? '(untitled)',
      slug: (e.fields.slug as string) ?? '',
      category: (e.fields.category as string) ?? '',
      // Same defensive filter lib/contentful.ts uses: `tags` is an optional
      // symbol list, so an entry that never set it has no array at all.
      tags: Array.isArray(e.fields.tags)
        ? e.fields.tags.filter((t): t is string => typeof t === 'string')
        : [],
      published: e.fields.published === true,
      state: visibleState(e.sys, e.fields.published === true),
      coverUrl: coverUrlOf(e.fields),
      updatedAt: e.sys.updatedAt,
    }
  })
}

export async function getRawProject(id: string): Promise<RawEntry | null> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    'sys.id': id,
    include: 2,
    limit: 1,
  })
  return (res.items[0] as unknown as RawEntry) ?? null
}

/** A slug is the site's permanent URL for a project, so two projects must
 *  never share one. `exceptId` lets a project keep its own slug on edit.
 *
 *  Queried through the preview client on purpose: a draft already holding the
 *  slug is invisible to the delivery API, so a delivery-side check would only
 *  discover the clash at publish time. */
export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    'fields.slug': slug,
    limit: 2,
  })
  return res.items.some((item) => (item as unknown as RawEntry).sys.id !== exceptId)
}

export type AdminShot = {
  id: string
  /** Thumbnail, for the strip. */
  url: string
  /** The same image at canvas size, for the editor's preview pane. */
  previewUrl: string
  width: number
  height: number
}

/** Pure: derives the strip's data from an entry the caller ALREADY has.
 *  getRawProject is an uncached preview round trip, and the edit page has one
 *  in hand, so re-fetching just to list the shots would double it per load.
 *
 *  Both URLs go through imageUrl so they resolve at the lib/media.ts
 *  chokepoint rather than as full-resolution originals — the same reason
 *  coverUrlOf does it above. Two sizes, not one: the strip would waste
 *  bandwidth on a canvas-sized image and the canvas would look soft on a
 *  thumbnail-sized one. */
export function shotsOf(entry: RawEntry): AdminShot[] {
  if (!Array.isArray(entry.fields.shots)) return []

  return (entry.fields.shots as unknown[]).flatMap((raw) => {
    const shot = raw as {
      sys?: { id?: string }
      fields?: {
        width?: number
        height?: number
        image?: { fields?: { file?: { url?: string } } }
      }
    }
    const id = shot?.sys?.id
    const url = shot?.fields?.image?.fields?.file?.url
    const width = shot?.fields?.width
    const height = shot?.fields?.height
    // Same rule as the public mapper: a shot without dimensions would collapse
    // the layout, so it is dropped rather than rendered.
    return id && url && width && height
      ? [{ id, url: imageUrl(url, 240), previewUrl: imageUrl(url, 1200), width, height }]
      : []
  })
}

/** Whether any shot OTHER than `exceptShotId` points at this asset.
 *
 *  Asked before deleting a shot's image, never after: Contentful's read APIs
 *  are eventually consistent, so a just-deleted shot can still come back in
 *  this query and a count taken afterwards would read as "still in use".
 *
 *  In practice uploads create exactly one asset per shot, so this is a guard
 *  rather than an expectation — but the failure it guards against is silent
 *  (another project's image vanishing) and the query is one cheap round trip. */
export async function assetInUseElsewhere(
  assetId: string,
  exceptShotId: string,
): Promise<boolean> {
  const res = await previewClient().getEntries({
    content_type: 'shot',
    'fields.image.sys.id': assetId,
    limit: 5,
  })
  return res.items.some((item) => (item as unknown as RawEntry).sys.id !== exceptShotId)
}

export async function getProjectShots(id: string): Promise<AdminShot[]> {
  const entry = await getRawProject(id)
  return entry ? shotsOf(entry) : []
}

export function coverShotId(entry: RawEntry): string | undefined {
  return (entry.fields.coverShot as { sys?: { id?: string } } | undefined)?.sys?.id
}

/** The single `siteSettings` entry, read uncached so the studio sees the
 *  draft `projectOrder` rather than the last published one. Returns the raw
 *  entry, not just the array, because saving the order needs `sys.id` to
 *  address the write and `sys.updatedAt` for the optimistic lock. */
export async function getSettingsEntry(): Promise<RawEntry | null> {
  const res = await previewClient().getEntries({ content_type: 'siteSettings', limit: 1 })
  return (res.items[0] as unknown as RawEntry) ?? null
}
