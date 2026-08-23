/**
 * P0.6 — test fixtures.
 *
 *   npm run seed          create
 *   npm run seed:clean    remove everything this script made
 *
 * 30 projects, sized and shaped to make the masonry judgeable: portrait
 * dominant like the real product surface, with landscape and square mixed
 * in, a spread of shot counts, and both video playback paths.
 *
 * Imagery comes from LoremFlickr by subject tag (posters, typography,
 * fashion editorial, exhibitions, sculpture) so the grid reads like a
 * design portfolio rather than a stock landscape reel. `lock` makes each
 * pick deterministic, so re-running produces the same set.
 *
 * These are Flickr images standing in for real work. They are marked
 * (project slugs start `test-`, shot captions and asset titles start
 * `[test]`) and `npm run seed:clean` removes all of them before the real
 * content goes in at P2.
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
const pause = () => new Promise((r) => setTimeout(r, 160))

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

/** Subject tags, chosen to match the reference: art, fashion, graphics. */
const TAGS = {
  poster: 'poster,typography',
  type: 'typography,lettering',
  graphic: 'graphicdesign',
  fashion: 'fashion,editorial',
  runway: 'fashion,runway',
  art: 'exhibition,art',
  sculpture: 'sculpture,gallery',
  print: 'magazine,editorial',
  brand: 'branding,identity',
  textile: 'textile,pattern',
  still: 'stilllife,studio',
  gallery: 'installation,museum',
}

/** Portrait-dominant, as the real grid is. */
const SHAPES = {
  tall: [880, 1320],
  portrait: [900, 1200],
  book: [880, 1100],
  square: [1000, 1000],
  wide: [1400, 950],
  pano: [1500, 850],
}

let lockCounter = 100
const nextLock = () => lockCounter++

async function makeAsset(tag, shape, label) {
  const [w, h] = SHAPES[shape]
  const lock = nextLock()

  let asset = await client.asset.create(
    {},
    {
      fields: {
        title: { [LOCALE]: `[test] ${label} ${w}x${h}` },
        file: {
          [LOCALE]: {
            contentType: 'image/jpeg',
            fileName: `test-${lock}.jpg`,
            upload: `https://loremflickr.com/${w}/${h}/${TAGS[tag]}?lock=${lock}`,
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

async function makeShot(tag, shape, label, options = {}) {
  const { kind = 'image', mp4, webm } = options
  const asset = await makeAsset(tag, shape, label)
  const entry = await client.entry.create(
    { contentTypeId: 'shot' },
    {
      fields: L({
        caption: `[test] ${label}`,
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
  return link(entry.sys.id)
}

/* ------------------------------------------------------------------ *
 * The 30. Shapes are deliberately uneven so column balancing is
 * visible, and metadata density varies so empty rows get exercised.
 * ------------------------------------------------------------------ */

const PROJECTS = [
  { t: 'Vantage Identity', tag: 'brand', shape: 'portrait', cat: 'Graphics & Socials', year: 2025, extra: 3, tools: ['Illustrator'], client: 'Vantage' },
  { t: 'Nocturne Poster Series', tag: 'poster', shape: 'tall', cat: 'Creatives', year: 2025, extra: 5, type: 'Series' },
  { t: 'Halcyon Editorial', tag: 'print', shape: 'book', cat: 'Creatives', year: 2024, extra: 2 },
  { t: 'Meridian App', tag: 'graphic', shape: 'portrait', cat: 'Product design', year: 2025, extra: 4, tools: ['Figma', 'Framer'], client: 'Meridian', links: [{ label: 'Live', url: 'https://example.com' }] },
  { t: 'Atelier Lookbook', tag: 'fashion', shape: 'tall', cat: 'Creatives', year: 2024, extra: 6 },
  { t: 'Static Bloom', tag: 'art', shape: 'square', cat: 'Creatives', year: 2023 },
  { t: 'Kern & Counter', tag: 'type', shape: 'portrait', cat: 'Graphics & Socials', year: 2025, extra: 2, type: 'Type study' },
  { t: 'Wavelength Studio', tag: 'brand', shape: 'wide', cat: 'Framer', year: 2025, tools: ['Framer'], links: [{ label: 'Visit', url: 'https://example.com' }] },
  { t: 'Concrete Season', tag: 'sculpture', shape: 'portrait', cat: 'Creatives', year: 2024, extra: 3 },
  { t: 'Pallas Runway', tag: 'runway', shape: 'tall', cat: 'Creatives', year: 2025, video: 'featured' },
  { t: 'Grain & Weave', tag: 'textile', shape: 'square', cat: 'Graphics & Socials', year: 2023, extra: 2 },
  { t: 'Fold Magazine', tag: 'print', shape: 'book', cat: 'Creatives', year: 2024, extra: 4, type: 'Editorial' },
  { t: 'Orbit Dashboard', tag: 'graphic', shape: 'wide', cat: 'Product design', year: 2025, extra: 3, tools: ['Figma'], client: 'Orbit' },
  { t: 'Quiet Objects', tag: 'still', shape: 'portrait', cat: 'Creatives', year: 2023 },
  { t: 'Vessel', tag: 'gallery', shape: 'pano', cat: 'Creatives', year: 2024 },
  { t: 'Type Specimen No.4', tag: 'type', shape: 'tall', cat: 'Graphics & Socials', year: 2025, extra: 2 },
  { t: 'Northline Rebrand', tag: 'brand', shape: 'square', cat: 'Graphics & Socials', year: 2024, extra: 3, client: 'Northline' },
  { t: 'Soft Machine', tag: 'art', shape: 'portrait', cat: 'Creatives', year: 2025, video: 'hover' },
  { t: 'Cassette Culture', tag: 'poster', shape: 'book', cat: 'Creatives', year: 2023, extra: 2 },
  { t: 'Lumen Site', tag: 'graphic', shape: 'wide', cat: 'Framer', year: 2025, tools: ['Framer'], links: [{ label: 'Visit', url: 'https://example.com' }] },
  { t: 'Anatomy of a Grid', tag: 'poster', shape: 'tall', cat: 'Graphics & Socials', year: 2024, extra: 4, type: 'Study' },
  { t: 'Marrow', tag: 'sculpture', shape: 'portrait', cat: 'Creatives', year: 2023 },
  { t: 'Season Mix', tag: 'fashion', shape: 'book', cat: 'Creatives', year: 2025, extra: 3 },
  { t: 'Foundry Checkout', tag: 'graphic', shape: 'portrait', cat: 'Product design', year: 2024, extra: 2, tools: ['Figma'], client: 'Foundry' },
  { t: 'Paper Cuts', tag: 'print', shape: 'square', cat: 'Creatives', year: 2023 },
  { t: 'Undertow', tag: 'art', shape: 'pano', cat: 'Creatives', year: 2024, video: 'hover' },
  { t: 'Signal Mark', tag: 'brand', shape: 'square', cat: 'Graphics & Socials', year: 2025, extra: 2 },
  { t: 'Hall of Mirrors', tag: 'gallery', shape: 'portrait', cat: 'Creatives', year: 2024, extra: 5 },
  { t: 'Nine Studies', tag: 'textile', shape: 'tall', cat: 'Creatives', year: 2023, extra: 8, type: 'Series' },
  { t: 'Kaialan.com', tag: 'graphic', shape: 'wide', cat: 'Framer', year: 2025, tools: ['Next.js', 'Framer'], client: 'Self' },
]

const slugify = (title) =>
  'test-' +
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function seed() {
  console.log(`Seeding ${PROJECTS.length} projects...`)

  for (const [index, spec] of PROJECTS.entries()) {
    const isVideo = Boolean(spec.video)
    const cover = await makeShot(
      spec.tag,
      spec.shape,
      spec.t,
      isVideo
        ? {
            kind: 'video',
            mp4: SAMPLE_MP4,
            // One video deliberately ships without WebM.
            webm: spec.video === 'featured' ? SAMPLE_WEBM : undefined,
          }
        : {},
    )

    const shots = [cover]
    for (let i = 0; i < (spec.extra ?? 0); i++) {
      shots.push(await makeShot(spec.tag, i % 2 ? 'portrait' : 'book', `${spec.t} ${i + 2}`))
    }

    await client.entry
      .create(
        { contentTypeId: 'project' },
        {
          fields: L({
            title: spec.t,
            slug: slugify(spec.t),
            description: `${spec.t} — placeholder record for layout testing.`,
            category: spec.cat,
            tags: spec.tags,
            year: spec.year,
            type: spec.type,
            tools: spec.tools,
            client: spec.client,
            links: spec.links,
            coverShot: cover,
            shots,
            featured: spec.video === 'featured',
            published: true,
          }),
        },
      )
      .then(async (entry) => {
        await client.entry.publish({ entryId: entry.sys.id }, entry)
        await pause()
      })

    console.log(`  ${String(index + 1).padStart(2)}/${PROJECTS.length}  ${spec.t} (${shots.length} shots)`)
  }

  await ensureSiteSettings()
  console.log('Seed complete.')
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
  let projectCount = 0
  for (const p of projects.items) {
    if (!String(p.fields?.slug?.[LOCALE] ?? '').startsWith('test-')) continue
    await removeEntity('entry', p.sys.id)
    projectCount++
  }
  console.log(`  removed ${projectCount} projects`)

  const shots = await client.entry.getMany({ query: { content_type: 'shot', limit: 1000 } })
  let shotCount = 0
  for (const s of shots.items) {
    if (!String(s.fields?.caption?.[LOCALE] ?? '').startsWith('[test]')) continue
    await removeEntity('entry', s.sys.id)
    shotCount++
  }
  console.log(`  removed ${shotCount} shots`)

  const assets = await client.asset.getMany({ query: { limit: 1000 } })
  let assetCount = 0
  for (const a of assets.items) {
    if (!String(a.fields?.title?.[LOCALE] ?? '').startsWith('[test]')) continue
    await removeEntity('asset', a.sys.id)
    assetCount++
  }
  console.log(`  removed ${assetCount} assets`)
  console.log('Clean complete. siteSettings left in place.')
}

await (CLEAN ? clean() : seed())
