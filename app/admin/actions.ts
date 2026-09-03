'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  cmaEnv,
  createEntry,
  publishEntry,
  toAssetLink,
  toEntryLink,
  updateEntry,
  VersionConflictError,
} from '@/lib/cma'
import { getRawProject, slugExists } from '@/lib/preview'
import { isValidSlug } from '@/lib/admin/slug'
import { isRateLimited, mapWithLimit, retry } from '@/lib/admin/pool'

export type SaveState = { error?: string; savedAt?: number; id?: string }

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']

function csv(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Saves a DRAFT. It never publishes — on an already-live project the site
 *  keeps serving the last published version until Publish is pressed. */
export async function saveProject(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()

  if (!title) return { error: 'Title is required.' }
  if (!isValidSlug(slug)) return { error: 'Slug must be lowercase words joined by single hyphens.' }

  const yearRaw = String(formData.get('year') ?? '').trim()
  const category = String(formData.get('category') ?? '')
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.' }

  // `year` is a Contentful Integer. Number('abc') is NaN, which serialises to
  // null and would silently CLEAR the field under the null-clears convention
  // below; a non-integer would be rejected by Contentful at save. Refuse both
  // here so the failure is a message rather than lost data.
  let year: number | null = null
  if (yearRaw) {
    const parsed = Number(yearRaw)
    if (!Number.isInteger(parsed)) return { error: 'Year must be a whole number.' }
    year = parsed
  }

  const fields: Record<string, unknown> = {
    title,
    slug,
    // null, NOT undefined: updateEntry merges, so undefined would silently
    // keep the old value when the user empties the field.
    description: String(formData.get('description') ?? '').trim() || null,
    category,
    tags: csv(formData, 'tags'),
    year,
    type: String(formData.get('type') ?? '').trim() || null,
    tools: csv(formData, 'tools'),
    client: String(formData.get('client') ?? '').trim() || null,
    featured: formData.get('featured') === 'on',
  }

  // Slugs are the site's permanent URLs, so a collision must be refused
  // rather than silently producing two projects that fight over one route.
  if (await slugExists(slug, id === 'new' ? undefined : id)) {
    return { error: `The slug "${slug}" is already used by another project.` }
  }

  if (!id || id === 'new') {
    const created = await createEntry('project', { ...fields, published: false })
    updateTag('projects')
    redirect(`/admin/projects/${created.sys.id}`)
  }

  const existing = await getRawProject(id)
  if (!existing) return { error: 'That project no longer exists.' }

  // No `preserved` spread: updateEntry MERGES into the entry's own CMA fields,
  // so `published`, `shots`, `coverShot`, `links` and the deferred video URLs
  // survive untouched. Spreading `existing.fields` here would be actively
  // WRONG — those come from the CDA with links already resolved into full
  // entities, and writing them back would corrupt every reference.
  try {
    await updateEntry(id, fields, existing.sys.updatedAt)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'This project changed elsewhere. Reload before saving.' }
    }
    throw error
  }

  updateTag('projects')
  return { savedAt: Date.now(), id }
}

type Link = { sys: { id: string } }

const linkIds = (value: unknown): string[] =>
  Array.isArray(value) ? (value as Link[]).map((l) => l?.sys?.id).filter(Boolean) : []

/** mapWithLimit SETTLES — it never throws, so a rejection is a value you have
 *  to look at. Every publish step below must be checked before the next one
 *  runs, or the bottom-up ordering is decorative: the project would publish on
 *  top of shots that failed, which is the exact silent-missing-images outcome
 *  the ordering exists to prevent. */
function firstFailure(results: PromiseSettledResult<unknown>[], what: string): string | undefined {
  const rejected = results.filter((r) => r.status === 'rejected')
  if (rejected.length === 0) return undefined
  const reason = (rejected[0] as PromiseRejectedResult).reason
  const detail = reason instanceof Error ? reason.message : String(reason)
  return `${rejected.length} of ${results.length} ${what} failed to publish. Nothing was published. First error: ${detail}`
}

/** Publishes bottom-up: assets, then shots, then the project.
 *
 *  Order is not cosmetic. The CDA resolves links only to PUBLISHED records and
 *  lib/contentful.ts uses `.withoutUnresolvableLinks`, so publishing a project
 *  whose shots are still drafts yields a project with its images silently
 *  missing — no error anywhere. */
export async function publishProject(id: string): Promise<{ error?: string }> {
  const { client, spaceId, environmentId } = cmaEnv()
  const entry = await getRawProject(id)
  if (!entry) return { error: 'That project no longer exists.' }

  const coverId = (entry.fields.coverShot as Link | undefined)?.sys?.id
  const uniqueShotIds = [...new Set([...linkIds(entry.fields.shots), ...(coverId ? [coverId] : [])])]

  // Contentful refuses to publish a project whose required coverShot is unset,
  // so say why here rather than surfacing a raw validation payload.
  if (!coverId) return { error: 'Give this project a cover shot before publishing.' }

  const withRetry = <T>(fn: () => Promise<T>) =>
    retry(fn, { attempts: 4, baseMs: 500, shouldRetry: isRateLimited })

  // 1. read every shot, to discover the assets behind them
  const shots = await mapWithLimit(uniqueShotIds, 3, (shotId) =>
    withRetry(() => client.entry.get({ spaceId, environmentId, entryId: shotId })),
  )
  const unread = firstFailure(shots, 'shots could not be read and')
  if (unread) return { error: unread }

  const assetIds = new Set<string>()
  for (const result of shots) {
    if (result.status !== 'fulfilled') continue
    const image = result.value.fields?.image?.['en-US'] as Link | undefined
    if (image?.sys?.id) assetIds.add(image.sys.id)
  }

  // 2. the assets
  const assets = await mapWithLimit([...assetIds], 3, async (assetId) =>
    withRetry(async () => {
      const asset = await client.asset.get({ spaceId, environmentId, assetId })
      if (asset.sys.publishedVersion) return asset
      // v12 plain client takes the version from the payload's sys, not params.
      return client.asset.publish({ spaceId, environmentId, assetId }, asset)
    }),
  )
  const badAssets = firstFailure(assets, 'assets')
  if (badAssets) return { error: badAssets }

  // 3. the shot entries
  const published = await mapWithLimit(uniqueShotIds, 3, async (shotId) =>
    withRetry(async () => {
      const shot = await client.entry.get({ spaceId, environmentId, entryId: shotId })
      return client.entry.publish({ spaceId, environmentId, entryId: shotId }, shot)
    }),
  )
  const badShots = firstFailure(published, 'shots')
  if (badShots) return { error: badShots }

  // 4. the project itself, with published: true
  const fresh = await getRawProject(id)
  if (!fresh) return { error: 'That project no longer exists.' }
  await updateEntry(id, { published: true }, fresh.sys.updatedAt)
  await publishEntry(id)

  updateTag('projects')
  return {}
}

export async function unpublishProject(id: string): Promise<{ error?: string }> {
  const entry = await getRawProject(id)
  if (!entry) return { error: 'That project no longer exists.' }

  // Flip the flag and publish that change, so the entry stays readable by the
  // CDA while `published: false` takes it off the site. A real CMA unpublish
  // would also work, but this keeps one mechanism for "off the site" and
  // leaves the entry resolvable for anything still linking to it.
  await updateEntry(id, { published: false }, entry.sys.updatedAt)
  await publishEntry(id)

  updateTag('projects')
  return {}
}

export type UploadedAsset = { assetId: string; width: number; height: number }

/** Creates one `shot` per uploaded asset and appends them to the project.
 *  If the project has no cover yet, the first shot becomes it — otherwise a
 *  freshly created project renders nothing, since toProject() drops any
 *  project without a coverShot.
 *
 *  Shots are created sequentially rather than through mapWithLimit: they are
 *  cheap metadata-only writes, and the uploads that preceded them already
 *  spent the rate-limit budget. */
export async function addShots(
  projectId: string,
  assets: UploadedAsset[],
): Promise<{ error?: string }> {
  if (assets.length === 0) return {}

  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  const created = []
  for (const asset of assets) {
    const shot = await createEntry('shot', {
      kind: 'image',
      // toAssetLink, not toEntryLink: `image` is an Asset link, and a mislabelled
      // linkType is accepted by the type system and rejected by Contentful.
      image: toAssetLink(asset.assetId),
      width: asset.width,
      height: asset.height,
    })
    created.push(toEntryLink(shot.sys.id))
  }

  // project.fields comes from the CDA with include: 2, so existing shots are
  // RESOLVED ENTITIES. Narrow them back to links before writing, or the update
  // inlines whole entries where references belong.
  const existingShots = Array.isArray(project.fields.shots)
    ? (project.fields.shots as { sys?: { id?: string } }[]).map(toEntryLink)
    : []

  const shots = [...existingShots, ...created]
  const existingCover = project.fields.coverShot as { sys?: { id?: string } } | undefined
  const coverShot = existingCover ? toEntryLink(existingCover) : created[0]

  await updateEntry(projectId, { shots, coverShot }, project.sys.updatedAt)

  updateTag('projects')
  return {}
}
