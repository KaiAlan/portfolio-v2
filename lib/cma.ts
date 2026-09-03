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
 *  wrap in exactly one place. (Reads go through lib/preview.ts, which uses the
 *  CDA and hands back already-flattened fields, so there is no unwrap here.) */
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
 *  Pass `expectedVersion` (the version the edit was based on) for optimistic
 *  locking: a mismatch means someone else wrote in the meantime. */
export async function updateEntry(
  entryId: string,
  changed: Record<string, unknown>,
  expectedVersion?: number,
) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })

  if (expectedVersion !== undefined && current.sys.version !== expectedVersion) {
    throw new VersionConflictError()
  }

  current.fields = { ...current.fields, ...localize(changed) } as typeof current.fields
  return client.entry.update({ spaceId, environmentId, entryId }, current)
}

/** CDA-resolved entities carry `sys.id`, so this narrows a resolved entry (or
 *  an id) back to the link shape the CMA requires. */
export function toEntryLink(value: string | { sys?: { id?: string } }) {
  const id = typeof value === 'string' ? value : value?.sys?.id
  if (!id) throw new Error('Cannot build an entry link without an id.')
  return { sys: { type: 'Link', linkType: 'Entry', id } }
}

export async function publishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })
  return client.entry.publish({ spaceId, environmentId, entryId }, current)
}

export async function unpublishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  return client.entry.unpublish({ spaceId, environmentId, entryId })
}
