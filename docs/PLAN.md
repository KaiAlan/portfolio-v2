# kaialan.com — portfolio v2 + admin studio

## Context

The current portfolio (`KaiAlan/portfolio-kaialan`, Next.js + Tailwind + Lottie) keeps its content in a static `/data` folder — content is compiled into the source. Every update means editing code, and every asset means copying a CDN URL out of Contentful and pasting it into a file. That single root cause produces both stated pains.

v2 fixes it structurally: content lives in Contentful, the site reads it, and a private `/admin` studio — designed in Figma, built here — handles upload, project creation, ordering, and publish/unpublish with a UI tuned to this portfolio rather than Contentful's generic one.

Shape of the site: a cosmos.so-style masonry feed of shots (no case studies), a lightbox/detail view, and a separate Shop page of external-link cards. Everything on free tiers, no card charged.

---

## Locked decisions

| Area | Decision |
|---|---|
| Structured content | Contentful Free (CDA read, CMA write) |
| Images | Contentful assets + Images API (`?w=&fm=webp&q=`) |
| Video | Cloudflare R2, served from `cdn.kaialan.com` |
| Host | Vercel Hobby, one Next.js app, one repo, **private** |
| Studio | `/admin` route group in the same app, password + TOTP |
| Detail view | Intercepting routes — lightbox on click, full page on direct visit |
| Grid video | 3–5 `featured` loops autoplay; rest hover-to-play; pause off-viewport |
| Ordering | Single ordered array in a `siteSettings` singleton, written on Save |
| Theme | Light only. One typeface + optional mono. No theme toggle, no search bar |
| Motion | Motion (`layout` for filter re-flow, `layoutId` for card→lightbox morph) |
| Launch scope | ~15 curated projects; bulk-import the rest through the studio at P3 |

**Free-tier ceilings to respect** — Contentful Free: 50 GB/mo asset bandwidth *(hard cap — delivery APIs pause until the 1st, so this is the one number that can take the site down)*, 100k API calls/mo, 50 MB max asset, 10k records, 25 content types, CMA 7 req/s. R2 free: 10 GB storage, 10M reads/mo, **$0 egress, uncapped**. Vercel Hobby: 100 GB transfer, 5K image transformations, **4.5 MB request body**, no billing (it pauses instead).

Projected usage at 2k visits/mo with video on R2: **~10 GB Contentful bandwidth, 20% of cap.**

---

## Architecture

```
kaialan.com  (Vercel, Next.js App Router)
├─ /                     masonry grid + category filters (URL query params)
├─ /work/[slug]          full detail page
│  └─ @modal/(.)work/[slug]   same component as lightbox over the grid
├─ /shop                 external-link cards
└─ /admin                private studio (middleware-gated)
   ├─ /assets            asset panel — browse, copy URL, publish/unpublish
   ├─ /projects          list, create, edit, bulk-drop shots
   └─ /order             drag-to-reorder, one Save write

reads  → Contentful CDA, cached + tagged, revalidateTag() from admin actions
writes → Contentful CMA + R2 (server-only tokens, Server Actions)
media  → images: Contentful CDN · video: cdn.kaialan.com (R2)
```

**Publish loop:** admin Server Action writes to Contentful → calls `revalidateTag('projects')` in-process → live in ~2s. No webhooks, no rebuilds, no Vercel build minutes.

**Cache posture:** all CDA reads go through one tagged, cached data layer. This keeps API calls near zero against the 100k cap *and* means a Contentful outage or bandwidth pause serves stale pages instead of a blank site.

---

## Content model (Contentful)

**`project`** — `title`, `slug`, `description`, `category` (Product design | Graphics & Socials | Creatives | Framer), `tags[]`, `year`, `type`, `tools[]`, `client`, `links[]` (label + url), `coverShot` (ref → shot), `shots[]` (refs → shot, ordered), `featured` (bool — autoplay in grid), `published` (bool).

**`shot`** — `kind` (image | video), `image` (Contentful asset; for video this is the poster frame), `videoMp4Url`, `videoWebmUrl`, `width`, `height`, `caption`.

**`shopItem`** — `title`, `description`, `image`, `externalUrl`, `priceLabel`, `published`.

**`siteSettings`** (singleton) — `projectOrder[]`, `shopOrder[]`, `visibleMetaRows[]`.

Notes that matter:
- **No per-entry `order` field.** Reorder rewrites one array in `siteSettings` → a single CMA write instead of 80.
- **`width`/`height` are mandatory** — they drive the masonry layout with zero CLS. Contentful returns image dimensions automatically; video dimensions come from `videoWidth`/`videoHeight` in the browser at upload.
- **Metadata rows** render only when globally enabled in `visibleMetaRows` **and** non-empty on the project. Both of your requirements, one rule.
- **`slug` is set at creation and warned about on edit** — changing it breaks every link you've shared.
- Single-shot projects still get a `project` wrapper, so the grid has one code path.

---

## Media pipeline

Vercel caps request bodies at **4.5 MB**, so files must never pass through a Route Handler.

**Images:** browser requests a presigned URL → `PUT` direct to `r2://staging/` → server calls CMA `createAsset({ file: { upload: "https://cdn.kaialan.com/staging/…" } })` → `processForAllLocales()` → `publish()` → delete the staging object. The management token never leaves the server; there is no size ceiling in the path.

**Video:** you produce `.mp4` + `.webm` locally via `scripts/encode.mjs` (ffmpeg wrapper: `npm run encode ./clip.mov`, emits both formats + `poster.jpg` + prints dimensions). Studio uploads all three presigned-direct to R2 / Contentful. **Fallback path for a machine without ffmpeg:** drop an MP4 alone and the studio derives the poster and dimensions in-browser via `<video>` + `<canvas>` — so travelling with a borrowed laptop still works, just without WebM.

All media URLs resolve through **one `mediaUrl(shot, size)` helper**. That keeps a future "move images to R2" a single-file change.

---

## Studio security (non-negotiables)

- `/admin` in a route group behind middleware; `noindex` + `robots.txt` disallow.
- Every CMA / R2 call in a Server Action or Route Handler. **No token is ever `NEXT_PUBLIC_`.**
- `iron-session` encrypted cookie: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Password compared with `timingSafeEqual`; TOTP via `otplib`; recovery codes generated at setup and stored hashed.
- Rate limit the login route (in-memory is fine at this scale).

---

## Build order

### P0 — Foundations
1. Contentful space: create the four content types above; capture Space ID, CDA token, CMA token.
2. Cloudflare: create R2 bucket, add payment method (free tier, $0), set a usage-alert notification.
3. Porkbun → point nameservers at Cloudflare (registration stays at Porkbun).
4. DNS: apex + `www` → Vercel, **set DNS-only / grey cloud** (proxying Cloudflare in front of Vercel double-CDNs and causes cache bugs). `cdn.kaialan.com` → R2 custom domain.
5. Scaffold Next.js + TS + Tailwind + Motion. Commit.
6. Hand-enter **5 test projects** in Contentful — mixed image/video, mixed shot counts, one `featured` — so the grid has real edge cases to render against.

**Verify:** `curl` the CDA and get the 5 projects. Load a video from `cdn.kaialan.com` in a browser and confirm it plays and isn't rate-limited.

### P1 — The portfolio
1. `lib/contentful.ts` — typed CDA client, tagged + cached fetches (`projects`, `shots`, `shop`, `settings`).
2. `lib/media.ts` — `mediaUrl(shot, size)`.
3. Custom masonry: absolute positioning computed from stored `width`/`height`, responsive column count, Motion `layout` for filter re-flow.
4. Cards: image, hover-to-play video, `featured` autoplay with `IntersectionObserver` pause off-viewport, `muted` + `playsInline` + `loop` + poster.
5. Category filters as URL query params — shareable, back-button-able.
6. `/work/[slug]` detail: metadata rail (Year · Category · Type · Tools · Client · Links, empty rows skipped), shots stacked and scrollable.
7. Intercepting route for the lightbox; `layoutId` morph from card; prev/next **scoped to the active filter**, arrow keys, Esc, swipe on touch.
8. `/shop` cards. Nav: socials + contact; profile-pic hover → about overlay (copy, links, quote).
9. Metadata, OG images, sitemap.

**Verify:** filter → cards animate to new positions, no layout shift, URL updates. Click a card → lightbox + URL change; refresh → full page; back → grid with filter intact. Throttle to Slow 4G and confirm nothing pops in blank. Lighthouse ≥ 90 on mobile.

### P2 — Launch
1. Deploy to Vercel, attach `kaialan.com`, set all env vars.
2. Enter your **15 strongest projects** through Contentful's UI (last time you'll do this).
3. Ship it.

**Verify:** live domain, HTTPS, all 15 render, video streams from `cdn.kaialan.com`. Check Contentful's usage dashboard after a week against the 50 GB projection.

### P3 — The studio
1. Auth: login page, `iron-session`, TOTP enrolment + recovery codes, middleware gate, rate limit.
2. Shell: dark UI, sidebar → Assets / Projects / Order.
3. Asset panel: grid of assets, search, copy-URL, publish/unpublish, delete-with-confirm.
4. Presigned upload endpoint + client uploader with progress; the staging→CMA image flow; R2 video flow with in-browser dimension extraction.
5. Project form: all fields, cover selection, **bulk-drop → many shots into the open project**, drag-reorder shots.
6. Order panel: drag-reorder projects, one `siteSettings` write on **Save**.
7. `revalidateTag` after every mutation.
8. `scripts/encode.mjs`.

**Verify:** create a project end-to-end in the studio and watch it appear on the live site within ~5s. Upload a 40 MB video and confirm it succeeds (proves the 4.5 MB bypass). Log out, hit `/admin/projects` directly → redirected. Wrong TOTP → rejected. Confirm no CMA/R2 token appears in the client bundle (`grep` the `.next` output).

### P4 — Polish
Bulk-import the remaining ~55 projects through the studio. Motion refinement, loading/empty states, keyboard shortcuts in the studio, error toasts.

---

## Watch list

- **Contentful 50 GB/mo** is the only limit that can take the site down. Projection is 20% of cap; re-check monthly for the first three months. If it ever trends past ~60%, exercise the `mediaUrl` escape hatch and move images to R2.
- **Vercel Hobby is non-commercial**, and the Shop tab technically qualifies as advertising a product. Realistic consequence is an email, not a ban — hide Shop if it ever comes up.
- **R2 needs a card on file.** Egress is $0 at any volume and reads are 10M/mo free, so there is no runaway-bill path — but set the usage alert in P0 anyway.

## Backlog (explicitly not v1)

About / Contact / writing as standalone pages · search · sort · theme toggle · bulk-create-projects · WebM auto-transcode in-browser · analytics.
