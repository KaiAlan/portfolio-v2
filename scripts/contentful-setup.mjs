/**
 * Creates (or updates) the four content types from docs/PLAN.md.
 *
 *   npm run setup:contentful
 *
 * Idempotent: safe to re-run after editing a definition here. Types are
 * created in dependency order because `project` links to `shot`.
 */
import { createClient } from 'contentful-management'

const { CONTENTFUL_SPACE_ID, CONTENTFUL_MANAGEMENT_TOKEN } = process.env
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master'

if (!CONTENTFUL_SPACE_ID || !CONTENTFUL_MANAGEMENT_TOKEN) {
  console.error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_MANAGEMENT_TOKEN in .env.local')
  process.exit(1)
}

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']
const META_ROWS = ['year', 'category', 'type', 'tools', 'client', 'links']

const sym = (id, name, extra = {}) => ({ id, name, type: 'Symbol', ...extra })
const text = (id, name, extra = {}) => ({ id, name, type: 'Text', ...extra })
const int = (id, name, extra = {}) => ({ id, name, type: 'Integer', ...extra })
const bool = (id, name, extra = {}) => ({ id, name, type: 'Boolean', ...extra })
const symList = (id, name, validations = []) => ({
  id, name, type: 'Array', items: { type: 'Symbol', validations },
})
const entryLink = (id, name, to, extra = {}) => ({
  id, name, type: 'Link', linkType: 'Entry',
  validations: [{ linkContentType: to }], ...extra,
})
const entryList = (id, name, to) => ({
  id, name, type: 'Array',
  items: { type: 'Link', linkType: 'Entry', validations: [{ linkContentType: to }] },
})
const assetLink = (id, name, extra = {}) => ({
  id, name, type: 'Link', linkType: 'Asset', ...extra,
})

/** Ordered: `project` links to `shot`, so `shot` must exist first. */
const TYPES = [
  {
    id: 'shot',
    name: 'Shot',
    description: 'One image or one short loop video. The atom of the grid.',
    displayField: 'caption',
    fields: [
      sym('caption', 'Caption'),
      sym('kind', 'Kind', { required: true, validations: [{ in: ['image', 'video'] }] }),
      // For kind=video this is the poster frame.
      assetLink('image', 'Image / poster', {
        required: true,
        validations: [{ linkMimetypeGroup: ['image'] }],
      }),
      sym('videoMp4Url', 'Video MP4 URL'),
      sym('videoWebmUrl', 'Video WebM URL'),
      // Mandatory: these drive the masonry layout with zero CLS.
      int('width', 'Width (px)', { required: true }),
      int('height', 'Height (px)', { required: true }),
    ],
  },
  {
    id: 'project',
    name: 'Project',
    description: 'A wrapper around one or many shots. No case studies.',
    displayField: 'title',
    fields: [
      sym('title', 'Title', { required: true }),
      sym('slug', 'Slug', {
        required: true,
        validations: [
          { unique: true },
          { regexp: { pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' } },
        ],
      }),
      text('description', 'Description'),
      sym('category', 'Category', { required: true, validations: [{ in: CATEGORIES }] }),
      symList('tags', 'Tags'),
      int('year', 'Year'),
      sym('type', 'Type'),
      symList('tools', 'Tools'),
      sym('client', 'Client'),
      // [{ label, url }] — an Object field avoids a content type per link.
      { id: 'links', name: 'Links', type: 'Object' },
      entryLink('coverShot', 'Cover shot', ['shot'], { required: true }),
      entryList('shots', 'Shots', ['shot']),
      bool('featured', 'Featured (autoplays in grid)', { required: true }),
      bool('published', 'Published', { required: true }),
    ],
  },
  {
    id: 'shopItem',
    name: 'Shop item',
    description: 'An external-link card on /shop.',
    displayField: 'title',
    fields: [
      sym('title', 'Title', { required: true }),
      text('description', 'Description'),
      assetLink('image', 'Image', { required: true, validations: [{ linkMimetypeGroup: ['image'] }] }),
      sym('externalUrl', 'External URL', { required: true }),
      sym('priceLabel', 'Price label'),
      bool('published', 'Published', { required: true }),
    ],
  },
  {
    id: 'siteSettings',
    name: 'Site settings',
    description: 'Singleton. Keep exactly one published entry.',
    displayField: 'internalName',
    fields: [
      sym('internalName', 'Internal name', { required: true }),
      // Entry IDs, not slugs — survives a slug rename. Empty = fall back to newest-first.
      symList('projectOrder', 'Project order'),
      symList('shopOrder', 'Shop order'),
      symList('visibleMetaRows', 'Visible metadata rows', [{ in: META_ROWS }]),
      // The nav music player's source. Empty = the player does not render.
      sym('youtubePlaylistId', 'YouTube playlist ID'),
    ],
  },
]

const client = createClient(
  { accessToken: CONTENTFUL_MANAGEMENT_TOKEN },
  // v12 of the SDK returns the plain client; the getSpace().getEnvironment()
  // chain no longer exists.
  { type: 'plain', defaults: { spaceId: CONTENTFUL_SPACE_ID, environmentId: ENVIRONMENT } },
)

/** The SDK reports every failure as a thrown Error whose message is JSON.
 *  Only a genuine 404 means "not created yet" — anything else must surface. */
function statusOf(err) {
  if (typeof err?.status === 'number') return err.status
  try {
    return JSON.parse(err?.message ?? '{}').status
  } catch {
    return undefined
  }
}

// Preflight: a token that can authenticate but not reach the space would
// otherwise look like an empty space and try to create everything.
try {
  await client.space.get({ spaceId: CONTENTFUL_SPACE_ID })
} catch (err) {
  if (statusOf(err) === 401) {
    console.error(
      [
        '',
        `CMA token cannot reach space ${CONTENTFUL_SPACE_ID}.`,
        'The token is valid but has no organization access grant.',
        'Contentful -> Account settings -> Personal access tokens ->',
        'grant it access to your organization, or recreate it and tick the org.',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  throw err
}

for (const def of TYPES) {
  const { id, ...payload } = def
  const existing = await client.contentType.get({ contentTypeId: id }).catch((err) => {
    if (statusOf(err) === 404) return null
    throw err
  })

  const saved = existing
    ? await client.contentType.update({ contentTypeId: id }, { ...existing, ...payload })
    : await client.contentType.createWithId({ contentTypeId: id }, payload)

  console.log(`${existing ? 'updated' : 'created'}  ${id}`)

  await client.contentType.publish({ contentTypeId: id }, saved)
  // CMA allows 7 req/s; stay well under it.
  await new Promise((r) => setTimeout(r, 250))
}

console.log(`
Done — ${TYPES.length} content types live in ${CONTENTFUL_SPACE_ID}/${ENVIRONMENT}.`)
