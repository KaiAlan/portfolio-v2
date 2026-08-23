/**
 * P0.6 — test fixtures with the edge cases the grid has to survive.
 *
 *   npm run seed          create
 *   npm run seed:clean    remove everything this script made
 *
 * Deliberately NOT the real portfolio content. Everything created here is
 * marked (project slugs start `test-`, shot captions and asset titles start
 * `[test]`) so it can be removed cleanly before the real 15 go in at P2.
 *
 * Images come from picsum.photos via Contentful's external-URL ingest, so
 * dimensions are whatever Contentful measures, not numbers we assert.
 */
import { createClient } from 'contentful-management'

const SPACE = process.env.CONTENTFUL_SPACE_ID
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || 'master'
const LOCALE = 'en-US'
const CLEAN = process.argv.includes('--clean')

if (!SPACE || !TOKEN) {
  console.error('Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN in .env.local')
  process.exit(1)
}

const client = createClient(
  { accessToken: TOKEN },
  { type: 'plain', defaults: { spaceId: SPACE, environmentId: ENVIRONMENT } },
)

/** CMA allows 7 req/s. */
const pause = () => new Promise((r) => setTimeout(r, 180))

/** Locale-wrap, dropping empties so optional fields stay genuinely absent. */
const L = (obj) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [k, { [LOCALE]: v }]),
  )

const link = (id, linkType = 'Entry') => ({ sys: { type: 'Link', linkType, id } })

const SAMPLE_MP4 =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
const SAMPLE_WEBM =
  'https://test-videos.co.uk/vids/bigbuckbunny/webm/vp9/360/Big_Buck_Bunny_1_10s_1MB.webm'

/** key: [seed, width, height] — a deliberate spread of aspect ratios. */
const SHOTS = {
  tall: ['tall', 800, 1400],
  portrait: ['portrait', 900, 1200],
  square: ['square', 1000, 1000],
  wide: ['wide', 1600, 900],
  ultrawide: ['ultrawide', 2000, 700],
  short: ['short', 1400, 600],
  smallSquare: ['smallsq', 600, 600],
  bigPortrait: ['bigport', 1200, 1800],
}

async function makeAsset(key) {
  const [seed, w, h] = SHOTS[key]
  let asset = await client.asset.create(
    {},
    {
      fields: {
        title: { [LOCALE]: '[test] ' + key + ' ' + w + 'x' + h },
        file: {
          [LOCALE]: {
            contentType: 'image/jpeg',
            fileName: 'test-' + seed + '.jpg',
            upload: 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h,
          },
        },
      },
    },
  )
  asset = await client.asset.processForAllLocales({}, asset)
  await client.asset.publish({ assetId: asset.sys.id }, asset)
  await pause()

  const image = asset.fields.file[LOCALE].details.image
  return { id: asset.sys.id, width: image.width, height: image.height }
}

async function makeShot(assetKey, options = {}) {
  const { kind = 'image', mp4, webm, caption } = options
  const asset = await makeAsset(assetKey)
  const entry = await client.entry.create(
    { contentTypeId: 'shot' },
    {
      fields: L({
        caption: '[test] ' + (caption ?? assetKey),
        kind,
        image: link(asset.id, 'Asset'),
        videoMp4Url: mp4,
        videoWebmUrl: webm,
        width: asset.width,
        height: asset.height,
      }),
    },
  )
  await client.entry.publish({ entryId: entry.sys.id }, entry)
  await pause()
  return entry.sys.id
}

async function makeProject(fields) {
  const entry = await client.entry.create({ contentTypeId: 'project' }, { fields: L(fields) })
  await client.entry.publish({ entryId: entry.sys.id }, entry)
  await pause()
  console.log('  project  ' + fields.slug)
  return entry.sys.id
}

/** Singleton. Created once; never removed by --clean, it is real config. */
async function ensureSiteSettings() {
  const existing = await client.entry.getMany({ query: { content_type: 'siteSettings', limit: 1 } })
  if (existing.items.length > 0) {
    console.log('  siteSettings already exists, left alone')
    return
  }
  const entry = await client.entry.create(
    { contentTypeId: 'siteSettings' },
    {
      fields: L({
        internalName: 'Site settings',
        visibleMetaRows: ['year', 'category', 'type', 'tools', 'client', 'links'],
      }),
    },
  )
  await client.entry.publish({ entryId: entry.sys.id }, entry)
  console.log('  siteSettings created')
}

async function seed() {
  console.log('Seeding test fixtures...')

  // 1. One extreme-portrait image, every metadata row populated.
  const tall = await makeShot('tall')
  await makeProject({
    title: 'Tall Single',
    slug: 'test-tall-single',
    description:
      'Single extreme-portrait shot. Exercises the tallest card the masonry has to place, and a fully populated metadata rail.',
    category: 'Product design',
    tags: ['ui', 'mobile'],
    year: 2025,
    type: 'Concept',
    tools: ['Figma', 'Framer'],
    client: 'Acme',
    links: [
      { label: 'Live site', url: 'https://example.com' },
      { label: 'Case study', url: 'https://example.com/case' },
    ],
    coverShot: link(tall),
    shots: [link(tall)],
    featured: false,
    published: true,
  })

  // 2. Four wide shots, almost no metadata — proves empty rows are skipped.
  const wides = []
  for (const key of ['wide', 'ultrawide', 'short', 'square']) {
    wides.push(await makeShot(key))
  }
  await makeProject({
    title: 'Wide Multi',
    slug: 'test-wide-multi',
    description: 'Four landscape shots of differing ratios. Sparse metadata on purpose.',
    category: 'Graphics & Socials',
    year: 2024,
    coverShot: link(wides[0]),
    shots: wides.map((id) => link(id)),
    featured: false,
    published: true,
  })

  // 3. Featured video — the autoplay path.
  const videoCover = await makeShot('square', {
    kind: 'video',
    mp4: SAMPLE_MP4,
    webm: SAMPLE_WEBM,
    caption: 'featured video cover',
  })
  const still = await makeShot('portrait')
  await makeProject({
    title: 'Video Featured',
    slug: 'test-video-featured',
    description: 'Featured, so it autoplays in the grid and must pause off-viewport.',
    category: 'Creatives',
    tags: ['motion'],
    year: 2025,
    tools: ['After Effects'],
    coverShot: link(videoCover),
    shots: [link(videoCover), link(still)],
    featured: true,
    published: true,
  })

  // 4. Non-featured video, MP4 only — hover-to-play, no WebM fallback.
  const hoverVideo = await makeShot('wide', {
    kind: 'video',
    mp4: SAMPLE_MP4,
    caption: 'hover video, mp4 only',
  })
  await makeProject({
    title: 'Video Hover',
    slug: 'test-video-hover',
    description: 'Plays on hover only, and has no WebM source.',
    category: 'Framer',
    year: 2024,
    client: 'Self',
    coverShot: link(hoverVideo),
    shots: [link(hoverVideo)],
    featured: false,
    published: true,
  })

  // 5. Eight mixed shots — the heaviest detail view.
  const many = []
  for (const key of [
    'bigPortrait',
    'smallSquare',
    'wide',
    'tall',
    'short',
    'portrait',
    'ultrawide',
    'square',
  ]) {
    many.push(await makeShot(key))
  }
  await makeProject({
    title: 'Square Many',
    slug: 'test-square-many',
    description: 'Eight shots, every orientation. Stresses the detail scroll and prev/next.',
    category: 'Creatives',
    tags: ['grid', 'stress'],
    year: 2023,
    type: 'Series',
    tools: ['Photoshop', 'Blender'],
    links: [{ label: 'Behance', url: 'https://behance.net' }],
    coverShot: link(many[0]),
    shots: many.map((id) => link(id)),
    featured: false,
    published: true,
  })

  // 6. An unpublished project — must never reach the site.
  const hidden = await makeShot('smallSquare', { caption: 'unpublished' })
  await makeProject({
    title: 'Unpublished Draft',
    slug: 'test-unpublished',
    description: 'published=false. Should be absent from every query.',
    category: 'Creatives',
    coverShot: link(hidden),
    shots: [link(hidden)],
    featured: false,
    published: false,
  })

  await ensureSiteSettings()
  console.log('Seed complete.')
}

async function removeEntity(kind, id) {
  const api = kind === 'asset' ? client.asset : client.entry
  const idKey = kind === 'asset' ? 'assetId' : 'entryId'
  const current = await api.get({ [idKey]: id })
  if (current.sys.publishedVersion) {
    await api.unpublish({ [idKey]: id })
    await pause()
  }
  await api.delete({ [idKey]: id })
  await pause()
}

async function clean() {
  console.log('Removing test fixtures...')

  // Projects first — they hold the references to the shots.
  const projects = await client.entry.getMany({ query: { content_type: 'project', limit: 1000 } })
  for (const p of projects.items) {
    const slug = String(p.fields?.slug?.[LOCALE] ?? '')
    if (!slug.startsWith('test-')) continue
    await removeEntity('entry', p.sys.id)
    console.log('  removed project ' + slug)
  }

  const shots = await client.entry.getMany({ query: { content_type: 'shot', limit: 1000 } })
  let shotCount = 0
  for (const s of shots.items) {
    if (!String(s.fields?.caption?.[LOCALE] ?? '').startsWith('[test]')) continue
    await removeEntity('entry', s.sys.id)
    shotCount++
  }
  console.log('  removed ' + shotCount + ' shots')

  const assets = await client.asset.getMany({ query: { limit: 1000 } })
  let assetCount = 0
  for (const a of assets.items) {
    if (!String(a.fields?.title?.[LOCALE] ?? '').startsWith('[test]')) continue
    await removeEntity('asset', a.sys.id)
    assetCount++
  }
  console.log('  removed ' + assetCount + ' assets')
  console.log('Clean complete. siteSettings left in place.')
}

await (CLEAN ? clean() : seed())
