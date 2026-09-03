# Design — `/admin` studio (P3), v1

**Date:** 2026-09-03
**Status:** approved, pending implementation plan
**Supersedes for v1:** `docs/PLAN.md` → P3 items 1–8, where noted below.

---

## Goal

Enter and curate real portfolio content without touching Contentful's UI.

That is the whole justification (see the `portfolio-v2-project` memory: the
studio exists because Kai dislikes Contentful's UI, *not* because of
link-copying). v1 is therefore measured by one thing: **can 15 real projects be
entered comfortably, start to finish, in this tool?**

### Knowing deviation from the plan

`docs/PLAN.md` and `~/.claude/AGENTS.md` both say to build internal tooling
*after* the thing it serves is live. This builds it before. That was raised and
overridden deliberately on 2026-09-03 — the studio is being treated as the way
content gets in, rather than a convenience added afterwards. Recorded so the
reversal is visible rather than accidental.

---

## Scope

**In:**
- Password gate for `/admin`
- Project list showing drafts and live entries
- Project form — every `project` field, cover selection, shot reorder
- Bulk drop — many images at once into the open project
- Order panel — drag-reorder the feed, one `siteSettings` write
- Save draft / Publish
- Cache invalidation after every mutation

**Out of v1 (deferred, not cancelled):**
- Cloudflare R2, presigned uploads, the staging bucket — no account yet
- All video: `videoMp4Url` / `videoWebmUrl` / `scripts/encode.mjs`.
  **The schema fields stay exactly as they are.** `toShot()` already reads them
  and the studio must round-trip them untouched on save, so that turning video
  on later is additive.
- TOTP, recovery codes, login rate limiting
- Asset library (browse / search / delete)
- Shop item CRUD

### Runs on localhost only

This is load-bearing, not incidental. Vercel's 4.5 MB request-body cap is a
serverless limit that does not exist under `next dev`, and the entire
R2-staging design in `docs/PLAN.md` → "Media pipeline" exists solely to dodge
it. Running locally removes R2 from v1 by removing the problem.

**Before this is ever deployed** the deferred auth work and a real upload path
(R2 presigned, per the original plan) both become mandatory again.

---

## Verified constraints

Checked against the installed versions on 2026-09-03, not from memory:

| Fact | Source |
|---|---|
| Server Actions cap bodies at **1 MB** by default | `next/dist/docs/.../serverActions.md` |
| Route Handlers stream; no equivalent cap | same |
| `middleware.ts` is deprecated → **`proxy.ts`**, named export `proxy` | `.../upgrading/version-16.md:612` |
| Bare `revalidateTag(tag)` with no profile is **deprecated** | `.../revalidateTag.md` |
| `updateTag(tag)` is **Server-Action-only**, read-your-own-writes | `.../updateTag.md` |
| CMA v12 is plain-client only; `client.upload.create(params, {file})` accepts a `Stream` | `contentful-management/dist/types/plain/entities/upload.d.ts` |
| `asset.processForAllLocales()` and `asset.publish()` exist | `.../entities/asset.d.ts:96,149` |
| CDA returns published entries only; reads also filter `fields.published === true` | `lib/contentful.ts` |

---

## Architecture

```
proxy.ts                        gate /admin/*
lib/cma.ts                      server-only. The ONLY writer to Contentful
lib/preview.ts                  server-only. CDA via preview.contentful.com, uncached
app/admin/layout.tsx            shell: dark, sidebar, noindex
app/admin/page.tsx              project list
app/admin/projects/[id]/page.tsx  project form
app/admin/order/page.tsx        reorder
app/admin/login/page.tsx        login
app/admin/actions.ts            Server Actions — entities only
app/api/admin/upload/route.ts   Route Handler — bytes only
```

**The one rule: bytes go through the Route Handler, entities through Server
Actions.** Nothing else crosses that line. It splits on a real seam (streaming
vs structured writes) rather than an arbitrary one, and it is the seam that
survives the eventual R2 swap — presigned uploads change that one handler and
nothing else.

### `lib/contentful.ts` is not modified

The public site's read path stays byte-for-byte as it is. Every studio read
goes through the new `lib/preview.ts`. This is deliberate: it means no part of
this work can regress the live feed, and the two paths can be reasoned about
separately.

| | public site | studio |
|---|---|---|
| module | `lib/contentful.ts` | `lib/preview.ts` |
| host | `cdn.contentful.com` | `preview.contentful.com` |
| token | `CONTENTFUL_DELIVERY_TOKEN` | `CONTENTFUL_PREVIEW_TOKEN` |
| sees | published + `published: true` | everything, drafts included |
| caching | `use cache`, tagged, `cacheLife('days')` | **uncached** |

The studio must never render stale data — you would be editing against a lie.

---

## Auth

- `ADMIN_PASSWORD` from `.env.local`, compared with `crypto.timingSafeEqual`
- Session in an `iron-session` cookie: `HttpOnly`, `SameSite=Lax`,
  `Secure` only when not localhost
- `proxy.ts` redirects unauthenticated `/admin/*` → `/admin/login`
- `/admin` sets `robots: { index: false, follow: false }`; `app/robots.ts`
  gains a `/admin` disallow

Deferred, with the reason: TOTP, recovery codes and rate limiting protect a
studio reachable from the internet. This one is not. Adding them later touches
the login action and adds `otplib` — it does not restructure anything here.

---

## Screens

### Project list — `/admin`

Reads all projects through `lib/preview.ts`, so drafts appear. Columns: cover
thumbnail, title, category, status pill (**Draft** / **Live** / **Live ·
edited**, per the publish model below), updated-at. Primary action: New Project.

### Project form — `/admin/projects/[id]`

Every `project` field: `title`, `slug`, `description`, `category`, `tags[]`,
`year`, `type`, `tools[]`, `client`, `links[]`, `featured`.

- **Slug** is set freely at creation, and on edit shows a warning — changing it
  breaks every link already shared. Checked for collisions before write.
- **Shots strip** — horizontal, drag to reorder, click to set cover.
  `coverShot` is a separate reference field, so cover selection writes that
  field rather than reordering.
- **Bulk drop zone** — see the upload flow below.
- Buttons: **Save draft** and **Publish**.

### Order — `/admin/order`

Drag-reorder live projects. One `siteSettings.projectOrder` write on **Save**,
holding entry IDs, not slugs (a slug rename must not silently drop a project to
the end). Explicit save, not autosave — reordering is a curation decision and
should not fire a write per drag.

---

## Publish model

Two buttons mapping onto Contentful's own draft/published state:

| Action | CMA effect | `published` field | Visible on site |
|---|---|---|---|
| Save draft | update entry, leave unpublished | unchanged | no |
| Publish | update, set `published: true`, publish entry **and its shots and assets** | `true` | yes |
| Unpublish | set `published: false`, publish entry | `false` | no |

### Save draft on an already-live project

Contentful keeps a published version and a draft version of the same entry, so
"Save draft" on a **Live** project does *not* take it off the site — the site
keeps serving the last published version while your edits sit as a draft. This
is the correct behaviour (you can revise a live project without breaking it),
but it is surprising if unstated.

The list and the form must therefore show three states, not two:
**Draft** (never published) · **Live** · **Live · edited** (published version
differs from the draft). The third is `sys.publishedVersion` being set *and*
`sys.version > sys.publishedVersion + 1`.

**Publish order matters and is the classic failure here:** assets → shot
entries → project entry. The CDA resolves links only to *published* records,
and `lib/contentful.ts` uses `.withoutUnresolvableLinks`, so publishing a
project whose shots are still drafts yields a project whose shots silently
vanish — no error, just missing work. The publish action must walk the tree
bottom-up.

Drafts are invisible to the CDA by definition; that is the accepted cost of
this model, and `lib/preview.ts` is the mitigation — drafts are fully viewable
inside the studio.

---

## Upload flow

Bulk drop of N images:

1. **Client** posts each file to `/api/admin/upload`, **max 3 concurrent**
   (CMA is capped at 7 req/s; 3 leaves headroom for the entity writes).
2. **Handler**, per file:
   1. `client.upload.create({ spaceId, environmentId }, { file: stream })`
   2. `client.asset.create(..., { fields: { file: { uploadFrom: <Upload link> } } })`
   3. `asset.processForAllLocales()`
   4. **poll** `asset.get` until `fields.file[locale].url` exists
      (backoff, ~15 s ceiling)
   5. `asset.publish()`
   6. return `{ assetId, url, width, height }`
3. **Client** collects the results and calls `addShots(projectId, assets[])`.
4. That Server Action creates one `shot` entry per asset, appends them to
   `project.shots`, and calls `updateTag('projects')`.

### Two notes that will cost a day if missed

**Dimensions come free.** After processing, Contentful returns
`file.details.image.{width,height}`. No in-browser extraction is needed for
images — the `<video>`+`<canvas>` trick in `docs/PLAN.md` is a *video*
requirement and video is deferred.

**The poll in 2.iv is not optional.** `processForAllLocales` is asynchronous on
Contentful's side and the asset has no `file.url` until it completes. Creating
a shot from an unprocessed asset gives it an empty `imageUrl`, and
`toShot()` (`lib/contentful.ts:74`) drops any shot missing `imageUrl`,
`width` or `height`. The result is a project whose images disappear with no
error anywhere. Fail the file loudly on timeout instead.

---

## Cache invalidation

**This supersedes `docs/PLAN.md` P3.7**, which says "`revalidateTag` after
every mutation". In Next 16 that is wrong twice over: bare `revalidateTag(tag)`
with no profile is deprecated, and `updateTag` is the correct tool for a studio.

- **All invalidation lives in Server Actions**, using
  `updateTag(tag)` — read-your-own-writes, so the next request waits for fresh
  data rather than serving stale. Publish, reload, see it.
- **The upload Route Handler invalidates nothing.** It only creates assets; the
  entity write that follows is always an action. One place to reason about.

| Mutation | Tag |
|---|---|
| project create / update / publish / unpublish | `projects` |
| shot create / reorder / cover change | `projects` |
| order save | `settings` |

`getProjects()` is tagged with both, so a reorder correctly invalidates the
feed.

---

## Error handling

| Failure | Handling |
|---|---|
| CMA 429 (7 req/s cap) | concurrency cap of 3 + exponential backoff retry |
| Asset processing timeout | fail that file only, keep the rest, report per-file in the drop UI |
| `sys.version` conflict (CMA is optimistically locked) | refetch, retry once, then surface "changed elsewhere — reload" |
| Slug collision | checked before create; blocking field error |
| Partial bulk drop | successful files still become shots; failed ones listed with a retry affordance |

A partially-failed drop must never roll back the successes — re-uploading 18
good files because 2 failed is the exact frustration this tool exists to remove.

---

## Verification

Adapted from `docs/PLAN.md` P3 "Verify", minus the R2 items:

1. Create a project end-to-end, publish, and see it on `/` after one reload.
2. Bulk-drop 10 images → 10 shots, each with real `width`/`height`, none
   dropped from the rendered grid.
3. Reorder in `/admin/order`, save, confirm the feed order changes.
4. Save a draft → absent from `/`, present and editable in the studio.
5. Log out, hit `/admin/projects` directly → redirected to login.
6. `grep -r "$CONTENTFUL_MANAGEMENT_TOKEN" .next/` → **no match.**
7. Edit a project that has video URLs set; save; confirm both URL fields
   round-trip unchanged.

(7) is the guard on the deferred-video promise — the fields must survive the
studio even though nothing in the UI writes them yet.

---

## Dependencies and configuration

**Moves to `dependencies`:** `contentful-management` (currently a
devDependency; only scripts use it today, the studio needs it at runtime).

**New:** `iron-session`.

**New env vars** — add to `.env.example` (names only, never values):

```
CONTENTFUL_PREVIEW_TOKEN=    # same Contentful API key as delivery, preview token
ADMIN_PASSWORD=
SESSION_SECRET=              # >= 32 chars, for iron-session
```

None are `NEXT_PUBLIC_`, and none may become so.

---

## Open item for Kai

The 30 seeded test projects are still in Contentful, so the project list will
open noisy. `npm run seed:clean` removes them (it deliberately leaves
`siteSettings` alone). Recommendation: keep them while the studio is being
built — they are useful and realistic test data, including the grid's edge
cases — and clean them immediately before entering real work at P2.

Not actioned; destructive, and Kai's call.
