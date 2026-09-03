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
