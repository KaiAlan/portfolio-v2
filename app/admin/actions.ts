'use server'

import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  cmaEnv,
  createEntry,
  deleteAsset,
  deleteEntry,
  LOCALE,
  publishEntry,
  toAssetLink,
  toEntryLink,
  updateEntry,
  VersionConflictError,
} from '@/lib/cma'
import {
  assetInUseElsewhere,
  coverShotId,
  getRawProject,
  getSettingsEntry,
  listProjects,
  slugExists,
} from '@/lib/preview'
import { planProjects } from '@/lib/admin/bulk'
import { isValidSlug } from '@/lib/admin/slug'
import { publishState } from '@/lib/admin/publish-state'
import { removeShot } from '@/lib/admin/shots'
import { parsePlaylistId } from '@/lib/music/playlist'
import { isRateLimited, mapWithLimit, retry } from '@/lib/admin/pool'

export type SaveState = { error?: string; savedAt?: number; id?: string }

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']

function csv(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Reads the new-project form's hidden list of already-uploaded assets.
 *
 *  Validated field by field rather than cast. This arrives as a string in a
 *  form body, so it is client input in the plainest sense — and a bad
 *  `assetId` here would be written straight into a Contentful link, producing
 *  a shot that points at nothing. Throws on malformed input so the caller can
 *  refuse the save instead of creating a project with junk attached. */
function parseAssets(raw: FormDataEntryValue | null): UploadedAsset[] {
  if (typeof raw !== 'string' || raw.trim() === '') return []

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Expected an array of assets.')

  return parsed.map((item) => {
    const a = item as Partial<UploadedAsset>
    if (
      typeof a?.assetId !== 'string' ||
      !a.assetId ||
      typeof a.width !== 'number' ||
      typeof a.height !== 'number'
    ) {
      throw new Error('Malformed asset.')
    }
    return {
      assetId: a.assetId,
      width: a.width,
      height: a.height,
      url: typeof a.url === 'string' ? a.url : '',
      name: typeof a.name === 'string' ? a.name : '',
    }
  })
}

/** Waits for Contentful's DELIVERY API to reflect a publish.
 *
 *  This exists because of a measured race, not a theoretical one. The delivery
 *  CDN lags a publish by roughly 1.5-3 seconds (measured against this space:
 *  stale at 1.5s and 2.1s, current at 2.9s). Every mutation here published and
 *  then invalidated in the same breath, so Next regenerated the feed INSIDE
 *  that window, re-read the old data, and — because getProjects() is
 *  `cacheLife('days')` — cached the stale answer for another day.
 *
 *  The symptom was a reorder that showed correctly in the studio and never
 *  appeared on the site. The studio reads the Preview API, which is uncached
 *  and has no CDN in front of it, so it always looked right; the two were
 *  never actually disagreeing about the data, only about when it arrived.
 *
 *  Polls until the entry's delivery-side `updatedAt` catches up to what was
 *  just written, then gives up. Giving up is safe and deliberate: the worst
 *  case is the old behaviour, and blocking a save on Contentful's CDN for
 *  longer than this would be worse than a late feed.
 *
 *  Only entries the public site actually reads need this — a draft is not on
 *  the delivery API at all, so there is nothing to wait for. */
async function awaitDelivery(entryId: string, notBefore: string, attempts = 10): Promise<void> {
  const space = process.env.CONTENTFUL_SPACE_ID
  const token = process.env.CONTENTFUL_DELIVERY_TOKEN
  const env = process.env.CONTENTFUL_ENVIRONMENT || 'master'
  if (!space || !token) return

  const url = `https://cdn.contentful.com/spaces/${space}/environments/${env}/entries/${entryId}`
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const entry = (await res.json()) as { sys?: { updatedAt?: string } }
        // String compare is correct here: these are ISO-8601 UTC timestamps.
        if (entry.sys?.updatedAt && entry.sys.updatedAt >= notBefore) return
      }
    } catch {
      // A failed probe is not a reason to fail the save. Fall through, retry,
      // and at worst invalidate as eagerly as the code did before.
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

/** Invalidates everything a mutation can change on the public site.
 *
 *  Three APIs, because they do three different jobs and the bug this fixes
 *  needed all of them. Measured against a production build, not reasoned about:
 *
 *  1. `updateTag` — read-your-own-writes. Expires the tag so the next request
 *     blocks for fresh data. Server Actions only.
 *  2. `revalidateTag(tag, 'max')` — marks tagged data stale so it refreshes
 *     with stale-while-revalidate semantics. A profile is required; without
 *     one it is the deprecated legacy behaviour.
 *  3. `revalidatePath` — and this is the one that actually fixed it.
 *
 *  Why (3) is not redundant with (1) and (2): `/` is a FULLY static prerender
 *  (`○` in the build output). Its HTML is its own cache entry, produced at
 *  build time, and it does not inherit the tags of the `use cache` functions
 *  whose output it embedded. So expiring the `projects` and `settings` tags
 *  invalidated `getProjects()` and changed nothing anybody could see — the
 *  route kept serving frozen HTML until its 1-day `cacheLife` ran out.
 *
 *  That was the reported bug: a reorder saved, the studio showed it (the
 *  studio reads the uncached Preview API), and the feed served the old
 *  sequence indefinitely. Verified fixed by driving a real reorder against a
 *  production build and reading the served HTML back.
 *
 *  Expect the FIRST request after a mutation to still be stale — that is
 *  stale-while-revalidate doing what it says — and every request after it to
 *  be current.
 *
 *  Anything that can change what a visitor sees goes through here. */
const PATHS_FOR_TAG: Record<string, ReadonlyArray<[string, 'page' | 'layout' | undefined]>> = {
  // The feed, every project detail page, and the sitemap all read projects.
  projects: [['/', undefined], ['/(site)/work/[slug]', 'page'], ['/sitemap.xml', undefined]],
  shop: [['/shop', undefined]],
  // siteSettings carries projectOrder, shopOrder, visibleMetaRows and the
  // playlist id — which between them reach every public route.
  settings: [['/', undefined], ['/shop', undefined], ['/(site)/work/[slug]', 'page']],
}

function invalidate(...tags: string[]) {
  const paths = new Set<string>()

  for (const tag of tags) {
    updateTag(tag)
    revalidateTag(tag, 'max')
    for (const [path, type] of PATHS_FOR_TAG[tag] ?? []) {
      // Keyed so two tags naming the same route revalidate it once.
      paths.add(JSON.stringify([path, type]))
    }
  }

  for (const entry of paths) {
    const [path, type] = JSON.parse(entry) as [string, 'page' | 'layout' | undefined]
    revalidatePath(path, type)
  }
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
    // Shots dropped on the new-project canvas. Their ASSETS are already in
    // Contentful — the upload route put them there, since uploading needs no
    // project — but nothing links them yet, and the form is the first moment
    // there is anything to link them to.
    let pending: UploadedAsset[]
    try {
      pending = parseAssets(formData.get('pendingAssets'))
    } catch {
      return { error: 'Something went wrong reading the dropped images. Reload and try again.' }
    }

    // Shots first, then the project that references them, so the project is
    // never briefly live with dangling links. A failure here leaves orphaned
    // shot entries, which cost nothing and are invisible on the site — the
    // same trade deleteShot makes, and for the same reason: a recoverable
    // orphan beats a project pointing at something that isn't there.
    const shots = await createShotEntries(pending)

    const created = await createEntry('project', {
      ...fields,
      published: false,
      ...(shots.length > 0 ? { shots, coverShot: shots[0] } : {}),
    })
    invalidate('projects')
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

  invalidate('projects')
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
  const publishedProject = await publishEntry(id)
  await awaitDelivery(id, publishedProject.sys.updatedAt)

  invalidate('projects')
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
  const hiddenProject = await publishEntry(id)
  await awaitDelivery(id, hiddenProject.sys.updatedAt)

  invalidate('projects')
  return {}
}

/** What the upload route hands back for one accepted file.
 *
 *  `url` and `name` are carried for the CLIENT's benefit, not this module's:
 *  the new-project canvas has to preview images that are not attached to
 *  anything yet, and bulk import titles each project from the file it came
 *  from. Both are ignored when a shot is created — Contentful already holds
 *  the asset and its own title by then. */
export type UploadedAsset = {
  assetId: string
  width: number
  height: number
  url: string
  name: string
}

/** Creates one `shot` entry per asset and returns them as links, in order.
 *
 *  Sequential rather than through mapWithLimit: these are cheap metadata-only
 *  writes, and the uploads that preceded them already spent the rate-limit
 *  budget. Shared by `addShots` (attach to an existing project), `saveProject`
 *  (a brand-new project created with its shots already on it) and
 *  `createProjectsFromAssets` (one shot per project), so all three build a
 *  shot exactly the same way. */
async function createShotEntries(assets: UploadedAsset[]) {
  const links = []
  for (const asset of assets) {
    const shot = await createEntry('shot', {
      kind: 'image',
      // toAssetLink, not toEntryLink: `image` is an Asset link, and a
      // mislabelled linkType is accepted by the type system and rejected by
      // Contentful.
      image: toAssetLink(asset.assetId),
      width: asset.width,
      height: asset.height,
    })
    links.push(toEntryLink(shot.sys.id))
  }
  return links
}

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

  const created = await createShotEntries(assets)

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

  invalidate('projects')
  return {}
}

export async function reorderShots(
  projectId: string,
  shotIds: string[],
): Promise<{ error?: string }> {
  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  const shots = shotIds.map(toEntryLink)
  await updateEntry(projectId, { shots }, project.sys.updatedAt)

  invalidate('projects')
  return {}
}

export type DeleteShotState = { error?: string; warning?: string }

/** Removes a shot from a project and destroys it — the entry and, unless
 *  something else claims it, the image behind it.
 *
 *  UNLINK FIRST, THEN DELETE, and never the other way round. If the destroy
 *  half fails you are left with an orphaned entry, which costs nothing and can
 *  be cleaned up later. The reverse order leaves a live project pointing at a
 *  record that no longer exists, and there is no undo for that.
 *
 *  This is the one studio action that reaches the public site without going
 *  through Publish. The confirmation step in the UI says so; see the comment
 *  on the republish below for why it cannot be deferred. */
export async function deleteShot(projectId: string, shotId: string): Promise<DeleteShotState> {
  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  // From the raw links, NOT from shotsOf(): that mapper drops shots missing
  // width/height the way the public one does, so building the new array out of
  // it would silently unlink every malformed shot as a side effect of deleting
  // one good one.
  const existing = linkIds(project.fields.shots).map((id) => ({ id }))
  const { shots, coverId, coverChanged, removed } = removeShot(
    existing,
    coverShotId(project),
    shotId,
  )
  if (!removed) return { error: 'That shot is no longer part of this project. Reload.' }

  // Read the asset link before the entry is gone — afterwards there is nothing
  // left to ask. Straight from the CMA rather than the CDA-resolved copy, so a
  // link the preview client failed to resolve cannot orphan an asset silently.
  const { client, spaceId, environmentId } = cmaEnv()
  const shotEntry = await client.entry.get({ spaceId, environmentId, entryId: shotId })
  const assetId = (shotEntry.fields?.image?.[LOCALE] as Link | undefined)?.sys?.id

  const changed: Record<string, unknown> = { shots: shots.map((s) => toEntryLink(s.id)) }
  // Only when it actually changed. Writing it unconditionally would republish
  // an identical cover on every delete; omitting it when it did change would
  // leave the project linking to an entry about to be destroyed.
  if (coverChanged) changed.coverShot = coverId ? toEntryLink(coverId) : null

  try {
    await updateEntry(projectId, changed, project.sys.updatedAt)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'This project changed elsewhere. Reload before deleting.' }
    }
    throw error
  }

  // A published project keeps serving its published version, which still links
  // to the shot about to be deleted. For an ordinary shot that is harmless:
  // lib/contentful.ts reads `.withoutUnresolvableLinks`, so the dead link drops
  // out on its own and the image simply leaves the site.
  //
  // The COVER is not harmless. toProject() discards any project whose cover
  // will not resolve, so a published project pointing at a deleted cover
  // vanishes from the feed entirely. The promoted cover therefore has to reach
  // the published version, and publish is per-ENTRY — so any saved-but-
  // unpublished edits to this project's own fields go live along with it.
  // That is a real side effect and the delete confirmation warns about it.
  let coverRepublishedAt: string | undefined
  if (coverChanged && publishState(project.sys) !== 'draft') {
    coverRepublishedAt = (await publishEntry(projectId)).sys.updatedAt
  }

  // Past this point the shot has already left the project, so a failure is a
  // WARNING and not an error: it is gone from the site either way, and a
  // caller that retried would re-run an unlink that already succeeded.
  let warning: string | undefined
  try {
    await deleteEntry(shotId)
    if (assetId && !(await assetInUseElsewhere(assetId, shotId))) {
      await deleteAsset(assetId)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    warning = `The shot was removed from this project, but cleaning it out of Contentful failed: ${detail}`
  }

  // Only when the cover was republished is there anything on the delivery API
  // to wait for; an ordinary shot deletion never touches the published version.
  if (coverRepublishedAt) await awaitDelivery(projectId, coverRepublishedAt)

  invalidate('projects')
  return warning ? { warning } : {}
}

export type DeleteProjectState = { error?: string; warning?: string }

/** Destroys a project, its shots, and the images under them.
 *
 *  **Gated on the project being off the site**, and that gate is enforced here
 *  rather than only in the UI. A hidden button is a suggestion; this is the
 *  thing that actually stops a live project from being deleted out from under
 *  the feed, and it re-reads the entry rather than trusting what the client
 *  believed when it rendered.
 *
 *  Off-site means `fields.published === false` OR never published at all. Note
 *  `publishState(sys)` is NOT the right question — `unpublishProject` leaves
 *  the entry published in Contentful on purpose, so a hidden project still
 *  reads as 'live' on that axis. See visibleState.
 *
 *  Order is the same rule `deleteShot` pays for, one level up: **unlink first,
 *  destroy second, and destroy the project LAST.** Emptying `shots` and
 *  `coverShot` before touching anything means a failure partway through leaves
 *  orphaned shot entries — invisible, recoverable, costing nothing — rather
 *  than a project pointing at records that no longer exist. Deleting the
 *  project first would strand every shot under it with no way to find them.
 *
 *  Everything after the unlink is a WARNING, never an error: the project is
 *  already gone from the studio and the site by then, and a caller that
 *  retried would be retrying work that already succeeded.
 *
 *  No republish is needed, unlike deleteShot's cover case. A project that is
 *  off the site is not in `getProjects()` at all, so nothing the public
 *  renders can be pointing at it. */
export async function deleteProject(id: string): Promise<DeleteProjectState> {
  const project = await getRawProject(id)
  if (!project) return { error: 'That project no longer exists.' }

  if (project.fields.published === true) {
    return { error: 'Unpublish this project before deleting it.' }
  }

  const shotIds = linkIds(project.fields.shots)

  // Collect the assets BEFORE the shots are destroyed — once a shot entry is
  // gone there is nothing left to say which image belonged to it.
  const assetIds = new Map<string, string>()
  for (const shotId of shotIds) {
    const shot = (project.fields.shots as { sys?: { id?: string }; fields?: { image?: { sys?: { id?: string } } } }[])
      .find((s) => s?.sys?.id === shotId)
    const assetId = shot?.fields?.image?.sys?.id
    if (assetId) assetIds.set(shotId, assetId)
  }

  // Unlink first. After this the project holds nothing, so whatever happens
  // below cannot leave it referencing a deleted record.
  try {
    await updateEntry(id, { shots: [], coverShot: null }, project.sys.updatedAt)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'This project changed elsewhere. Reload before deleting.' }
    }
    throw error
  }

  let warning: string | undefined
  const failures: string[] = []

  for (const shotId of shotIds) {
    try {
      await deleteEntry(shotId)
      const assetId = assetIds.get(shotId)
      // Same guard deleteShot uses: an asset another shot still points at is
      // not ours to destroy. In practice uploads are one asset per shot, so
      // this is a safety net rather than an expectation.
      if (assetId && !(await assetInUseElsewhere(assetId, shotId))) {
        await deleteAsset(assetId)
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  try {
    await deleteEntry(id)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      warning: `The project was emptied but could not be deleted: ${detail}. It is no longer on the site; remove it in Contentful.`,
    }
  }

  if (failures.length) {
    warning = `The project was deleted, but ${failures.length} of its ${shotIds.length} shots could not be cleaned out of Contentful. First error: ${failures[0]}`
  }

  invalidate('projects')
  return warning ? { warning } : {}
}

/** `coverShot` is its own reference field, so choosing a cover never reorders
 *  `shots` — the two are independent writes. */
export async function setCover(projectId: string, shotId: string): Promise<{ error?: string }> {
  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  await updateEntry(projectId, { coverShot: toEntryLink(shotId) }, project.sys.updatedAt)

  invalidate('projects')
  return {}
}

/** ONE write to siteSettings, holding entry IDs. Never a per-entry order
 *  field — that would be 80 writes instead of 1 — and never slugs, because a
 *  slug rename would silently drop a project to the end.
 *
 *  The array may be partial: applyOrder() ranks anything unlisted at the end,
 *  so a project created after the last reorder simply falls to the bottom
 *  rather than breaking the sort. */
/** Throws away assets uploaded on the new-project canvas and then removed
 *  before it was ever saved.
 *
 *  Uploading happens the moment a file is dropped, because the upload route
 *  validates real image dimensions and that has to happen before anything is
 *  attached. So an image removed from the canvas has ALREADY been created and
 *  published in Contentful, and dropping it from a client array alone would
 *  leave it sitting against the 50 GB/mo bandwidth cap with nothing pointing
 *  at it.
 *
 *  Safe only because these assets are unattached by construction — nothing on
 *  the new-project canvas has been linked to a shot yet. Never call it with an
 *  asset that a shot already references; `deleteShot` owns that path and
 *  checks `assetInUseElsewhere` first.
 *
 *  Best-effort and silent: the editor has already seen the thumbnail go, and
 *  failing to tidy up is not something they can act on. */
export async function discardAssets(assetIds: string[]): Promise<void> {
  await Promise.allSettled(assetIds.map((id) => deleteAsset(id)))
}

export type BulkCreateState = { error?: string; created: number; failed: string[] }

/** Creates one draft project per uploaded asset, titled from its filename.
 *
 *  The other half of the new-project drop zone: the same files that would
 *  become many shots of one project become many projects of one shot each.
 *  Which one you get is chosen after the drop, with the file count in front
 *  of you, because that is the only moment the choice is concrete.
 *
 *  Three things are deliberate here:
 *
 *  **Every slug is planned before anything is written.** `slugExists` asks
 *  Contentful one slug at a time, which cannot see a collision between two
 *  files in the SAME batch — neither entry exists when the other is checked,
 *  so dropping two files called `hero.png` would create two projects both
 *  claiming `/work/hero`. `planProjects` takes the whole space's slugs and the
 *  whole batch at once. See lib/admin/bulk.ts.
 *
 *  **Partial failure is tolerated, never rolled back.** Twenty files where
 *  three fail should leave seventeen projects and a list of the three, not
 *  make the editor drop everything and start again — the same call DropZone
 *  makes about uploads. Each project is independent, so there is no
 *  half-written state to unwind.
 *
 *  **Nothing is published.** These are drafts with a title, a slug, a category
 *  and one shot; the editor still has to open each one. Bulk import is for
 *  getting work INTO the studio, not onto the site. */
export async function createProjectsFromAssets(
  assets: UploadedAsset[],
  category: string,
  featured: boolean,
): Promise<BulkCreateState> {
  if (assets.length === 0) return { created: 0, failed: [] }
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.', created: 0, failed: [] }

  // One read for the whole batch. listProjects returns every project, so its
  // slugs are the complete set to avoid — checking each one separately would
  // be N round trips AND still miss the within-batch collisions above.
  const existing = await listProjects()
  const planned = planProjects(
    assets.map((a) => a.name),
    existing.map((p) => p.slug).filter(Boolean),
  )

  let created = 0
  const failed: string[] = []

  for (const [index, plan] of planned.entries()) {
    try {
      // One shot, and it is also the cover: toProject() drops any project
      // whose coverShot will not resolve, so a project created without one
      // would be invisible in the feed the moment it was published.
      const shots = await createShotEntries([assets[index]])
      await createEntry('project', {
        title: plan.title,
        slug: plan.slug,
        category,
        featured,
        published: false,
        shots,
        coverShot: shots[0],
      })
      created += 1
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      failed.push(`${plan.filename}: ${detail}`)
    }
  }

  if (created > 0) invalidate('projects')
  return { created, failed }
}

export async function saveOrder(projectIds: string[]): Promise<{ error?: string }> {
  const settings = await getSettingsEntry()
  if (!settings) {
    return { error: 'No siteSettings entry exists. Run npm run setup:contentful.' }
  }

  try {
    await updateEntry(settings.sys.id, { projectOrder: projectIds }, settings.sys.updatedAt)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'The order changed elsewhere. Reload before saving.' }
    }
    throw error
  }
  const published = await publishEntry(settings.sys.id)

  // Wait for delivery BEFORE invalidating, and wait on the timestamp the
  // publish actually returned rather than a clock reading — `Date.now()` here
  // is later than the entry's own updatedAt, so it could never be satisfied
  // and would just burn the whole timeout on every save. See awaitDelivery for
  // why any of this is needed: invalidating first is what re-cached the OLD
  // order for a day and made this look like a bug in applyOrder when the sort
  // was never wrong.
  await awaitDelivery(settings.sys.id, published.sys.updatedAt)

  invalidate('settings', 'projects')
  return {}
}

/** The nav player's source playlist. Accepts a pasted YouTube link or a bare
 *  id — parsePlaylistId does the reading, so the studio never asks anyone to
 *  extract an id by hand. Clearing the field removes the player entirely,
 *  which is a legitimate thing to want, so empty is valid input and not an
 *  error. */
export async function savePlaylist(input: string): Promise<{ error?: string }> {
  const settings = await getSettingsEntry()
  if (!settings) {
    return { error: 'No siteSettings entry exists. Run npm run setup:contentful.' }
  }

  const trimmed = input.trim()
  const playlistId = trimmed ? parsePlaylistId(trimmed) : ''
  if (playlistId === null) {
    return { error: 'That is not a YouTube playlist link or id.' }
  }

  try {
    await updateEntry(
      settings.sys.id,
      // null, not '': the empty string is a value Contentful would store,
      // while null clears the field — the convention lib/cma.ts documents.
      { youtubePlaylistId: playlistId || null },
      settings.sys.updatedAt,
    )
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'Settings changed elsewhere. Reload before saving.' }
    }
    throw error
  }
  const publishedSettings = await publishEntry(settings.sys.id)
  await awaitDelivery(settings.sys.id, publishedSettings.sys.updatedAt)

  invalidate('settings')
  return {}
}
