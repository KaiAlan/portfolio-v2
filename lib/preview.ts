/** Studio reads. Separate from lib/contentful.ts on purpose:
 *   - preview host, so DRAFTS are visible
 *   - uncached, because editing against stale data is editing against a lie
 *  lib/contentful.ts is never modified; the public site keeps its own path.
 */
import 'server-only'
import { createClient } from 'contentful'
import { publishState, type PublishState } from './admin/publish-state'
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
  state: PublishState
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
      state: publishState(e.sys),
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

export type AdminShot = { id: string; url: string; width: number; height: number }

/** Pure: derives the strip's data from an entry the caller ALREADY has.
 *  getRawProject is an uncached preview round trip, and the edit page has one
 *  in hand, so re-fetching just to list the shots would double it per load.
 *
 *  `url` goes through imageUrl so the strip's thumbnails resolve at the
 *  lib/media.ts chokepoint rather than as full-resolution originals — the same
 *  reason coverUrlOf does it above. */
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
    return id && url && width && height ? [{ id, url: imageUrl(url, 160), width, height }] : []
  })
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
