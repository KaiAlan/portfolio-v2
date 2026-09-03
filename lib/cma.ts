/** The ONLY module that writes to Contentful. Never imported by a Client
 *  Component; every caller is a Server Action or Route Handler. */
import 'server-only'
import { createClient, type PlainClientAPI } from 'contentful-management'

export type CmaEnv = {
  client: PlainClientAPI
  spaceId: string
  environmentId: string
}

export function cmaEnv(): CmaEnv {
  const accessToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN
  const spaceId = process.env.CONTENTFUL_SPACE_ID
  if (!accessToken || !spaceId) {
    throw new Error('Missing CONTENTFUL_MANAGEMENT_TOKEN / CONTENTFUL_SPACE_ID.')
  }
  // v12 is plain-client only.
  const client = createClient({ accessToken }, { type: 'plain' })
  return {
    client,
    spaceId,
    environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  }
}

/** Contentful stores every field per-locale. The site is single-locale, so
 *  wrap in exactly one place.
 *
 *  The value convention matters, because updateEntry MERGES:
 *   - `undefined` means "leave this field alone" — the key is omitted and the
 *     stored value survives the merge.
 *   - `null` means "clear this field" — it is sent through as an explicit null.
 *
 *  A caller rendering an optional input MUST emit `null`, not `undefined`, when
 *  the user empties it, or the old value silently persists behind a save that
 *  reports success. */
export const LOCALE = 'en-US'

export function localize(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, { [LOCALE]: value }]),
  )
}

/** Thrown when the entry moved on since the version the form was built from. */
export class VersionConflictError extends Error {
  constructor() {
    super('This entry changed elsewhere.')
    this.name = 'VersionConflictError'
  }
}

export async function createEntry(contentType: string, fields: Record<string, unknown>) {
  const { client, spaceId, environmentId } = cmaEnv()
  return client.entry.create(
    { spaceId, environmentId, contentTypeId: contentType },
    { fields: localize(fields) },
  )
}

/** Re-reads the entry so the CMA gets back exactly the shape it handed out —
 *  the plain client's `update` wants the whole entry, not a synthesised `sys`.
 *
 *  MERGES `changed` into the entry's existing fields. Callers pass ONLY what
 *  they are changing.
 *
 *  This is load-bearing, not a convenience. Reads come from lib/preview.ts via
 *  the CDA with `include: 2`, which resolves `shots` and `coverShot` into FULL
 *  ENTRY OBJECTS. Spreading those back into a CMA update would replace every
 *  link with an inlined entity and corrupt the references on the first save,
 *  silently. Merging server-side means untouched fields — including the
 *  deferred `videoMp4Url` / `videoWebmUrl` — are preserved structurally rather
 *  than by every caller remembering to re-send them.
 *
 *  Pass `expectedUpdatedAt` (the `sys.updatedAt` the edit was based on) for
 *  optimistic locking: a mismatch means someone else wrote in the meantime. */
export async function updateEntry(
  entryId: string,
  changed: Record<string, unknown>,
  expectedUpdatedAt?: string,
) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })

  // Optimistic lock on `updatedAt`, NOT on `version`: callers read through the
  // Preview API, which never returns `version`, so a version check would
  // compare against undefined and silently never fire.
  if (expectedUpdatedAt !== undefined && current.sys.updatedAt !== expectedUpdatedAt) {
    throw new VersionConflictError()
  }

  current.fields = { ...current.fields, ...localize(changed) } as typeof current.fields
  return client.entry.update({ spaceId, environmentId, entryId }, current)
}

type LinkType = 'Entry' | 'Asset'

function toLink(linkType: LinkType, value: string | { sys?: { id?: string } }) {
  const id = typeof value === 'string' ? value : value?.sys?.id
  if (!id) throw new Error(`Cannot build a ${linkType} link without an id.`)
  return { sys: { type: 'Link' as const, linkType, id } }
}

/** CDA-resolved entities carry `sys.id`, so these narrow a resolved entity (or
 *  a bare id) back to the link shape the CMA requires. */
export const toEntryLink = (value: string | { sys?: { id?: string } }) => toLink('Entry', value)
export const toAssetLink = (value: string | { sys?: { id?: string } }) => toLink('Asset', value)

export async function publishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })
  return client.entry.publish({ spaceId, environmentId, entryId }, current)
}

export async function unpublishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  return client.entry.unpublish({ spaceId, environmentId, entryId })
}
