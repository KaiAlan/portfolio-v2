# kaialan.com — portfolio v2

A cosmos.so-style portfolio: one full-bleed masonry feed of shots, a
lightbox detail view, a Shop page of external-link cards, and (later) a
private `/admin` studio for publishing without touching code.

**No case studies — everything is shots.** A project is a wrapper around
one or many shots.

> **Status:** in development. The feed, detail view and lightbox work
> against 30 seeded test fixtures. Not deployed; domain, CDN and host are
> not set up yet. See [`docs/HANDOFF.md`](docs/HANDOFF.md) for exactly
> what is done and what is left.

---

## Why it exists

The previous portfolio (`KaiAlan/portfolio-kaialan`) kept its content in a
static `/data` folder, so every update meant editing source and every
asset meant copying a CDN URL out of Contentful by hand. v2 fixes that
structurally: **content lives in Contentful and the site reads it.**

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19.2 | **Cache Components enabled** |
| Language | TypeScript | strict |
| Styling | Tailwind v4 | design tokens in `app/globals.css` |
| Motion | `motion` v13 | `layout` re-flow, `layoutId` card→lightbox morph |
| Content | Contentful Free | CDA to read, CMA to write |
| Images | Contentful Images API | deliberately **not** `next/image` |
| Video | Cloudflare R2 → `cdn.kaialan.com` | $0 egress; not yet provisioned |
| Host | Vercel Hobby | not yet provisioned |

Everything sits on free tiers with no card charged. Vercel Hobby pauses
rather than bills; Contentful Free has no overage.

---

## Getting started

**Prerequisites:** Node 20+ (developed on 24), npm, and a Contentful space.

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run setup:contentful       # creates the four content types
npm run seed                   # 30 test projects to develop against
npm run dev                    # http://localhost:3000
```

### Environment

`.env.local`, never committed:

| Variable | Required | What |
|---|---|---|
| `CONTENTFUL_SPACE_ID` | yes | Space ID |
| `CONTENTFUL_ENVIRONMENT` | yes | `master` |
| `CONTENTFUL_DELIVERY_TOKEN` | yes | CDA, read-only |
| `CONTENTFUL_MANAGEMENT_TOKEN` | scripts only | CMA, **write**. Server-only, never `NEXT_PUBLIC_` |
| `R2_*` | P3 | Cloudflare R2 credentials |
| `NEXT_PUBLIC_CDN_URL` | P3 | `https://cdn.kaialan.com` |
| `NEXT_PUBLIC_SITE_URL` | yes | used by metadata, sitemap, robots |

Tokens come from Contentful → **Settings → API keys**. The management
token additionally needs an **organization access grant** on the token —
without it every call 401s with `OrganizationAccessGrantRequired` even
though the token itself is valid.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run start` | serve the build |
| `npm run lint` | ESLint |
| `npm run setup:contentful` | create/update the four content types — idempotent |
| `npm run seed` | 30 test projects with real design imagery |
| `npm run seed:clean` | remove every seeded fixture (keeps `siteSettings`) |

---

## Architecture

```
app/
  page.tsx                     masonry feed
  work/[slug]/page.tsx         full detail page
  @modal/(.)work/[slug]/       same component, as a lightbox over the feed
  shop/page.tsx                external-link cards
  robots.ts · sitemap.ts · loading.tsx · not-found.tsx
components/
  navbar/  feed/  work/  shop/     feature-grouped
  ui/                              shadcn primitives (new-york, zinc, lucide)
hooks/                             use-element-width, use-category-filter
lib/
  contentful.ts                cached, tagged CDA reads
  media.ts                     the single mediaUrl() chokepoint
  types.ts                     domain types, decoupled from Contentful
  utils.ts                     cn()
scripts/                       content-model migration + seeding
docs/                          PLAN, CONTEXT, HANDOFF, COSMOS-DESIGN
```

### Content model

- **`project`** — wrapper around shots. `coverShot`, ordered `shots[]`,
  `category`, `featured`, `published`, plus optional metadata.
- **`shot`** — one image or one loop video. `width`/`height` are
  **mandatory**; they drive the masonry with zero layout shift.
- **`shopItem`** — an external-link card.
- **`siteSettings`** — singleton. `projectOrder` (entry IDs),
  `shopOrder`, `visibleMetaRows`.

### Caching

Every CDA read goes through one tagged, cached layer (`use cache` +
`cacheTag` + `cacheLife('days')`). This keeps API calls near zero against
the 100k/month cap, and means a Contentful outage or bandwidth pause
serves **stale pages instead of a blank site**. At P3, admin mutations
call `revalidateTag`/`updateTag` — no webhooks, no rebuilds, no Vercel
build minutes.

---

## Things that look wrong but are deliberate

**Images use `<img>`, not `next/image`.** Contentful's Images API already
resizes and serves WebP for free; `next/image` would spend Vercel Hobby's
5K/month transformation allowance redoing it. `@next/next/no-img-element`
is disabled for this reason.

**The category filter avoids `useSearchParams`.** Under Cache Components,
reading search params makes the subtree dynamic and ships the Suspense
fallback as the static shell — which left the prerendered feed with zero
cards. It now reads `window.location` via `useSyncExternalStore` and
writes with `history.pushState`.

**`usePathname` sits behind Suspense.** It is a dynamic API under Cache
Components and otherwise breaks the prerender of every route that renders
the header.

**The masonry renders a CSS-grid fallback before measuring**, so cards and
their links exist in server HTML. Measurement happens in
`useLayoutEffect`, so that fallback never paints.

---

## Known limitation

`/work/<unknown-slug>` returns **200 with the correct not-found UI**, not a
404. With Cache Components the static shell has already streamed, so the
status cannot change. Next injects `noindex`, so it stays out of search
results. A real 404 requires checking the slug in `proxy.ts` before the
response streams.

---

## Test fixtures

`npm run seed` creates 30 projects whose imagery comes from LoremFlickr by
subject tag and whose videos point at public sample files. **This is not
real work.** Everything is marked (`test-` slugs, `[test]` captions and
asset titles) so `npm run seed:clean` removes all of it before real
content goes in.

---

## Docs

| File | What |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | current state, what's left, gotchas — **start here** |
| [`docs/PLAN.md`](docs/PLAN.md) | the executable build plan, P0→P4 |
| [`docs/CONTEXT.md`](docs/CONTEXT.md) | locked decisions and the reasoning behind them |
| [`docs/COSMOS-DESIGN.md`](docs/COSMOS-DESIGN.md) | the design-token reference the palette came from |
