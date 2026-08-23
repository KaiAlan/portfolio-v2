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
    ],
  },
]

const client = createClient({ accessToken: CONTENTFUL_MANAGEMENT_TOKEN })
const space = await client.getSpace(CONTENTFUL_SPACE_ID)
const env = await space.getEnvironment(ENVIRONMENT)

for (const def of TYPES) {
  const { id, ...payload } = def
  let ct = await env.getContentType(id).catch(() => null)

  if (ct) {
    Object.assign(ct, payload)
    ct = await ct.update()
    console.log(`updated  ${id}`)
  } else {
    ct = await env.createContentTypeWithId(id, payload)
    console.log(`created  ${id}`)
  }

  await ct.publish()
  // CMA allows 7 req/s; stay well under it.
  await new Promise((r) => setTimeout(r, 250))
}

console.log(`\nDone — ${TYPES.length} content types live in ${CONTENTFUL_SPACE_ID}/${ENVIRONMENT}.`)
