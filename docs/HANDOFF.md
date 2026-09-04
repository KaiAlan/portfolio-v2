# Handoff — kaialan.com v2

Written for a session starting cold. Read `PLAN.md` for the full executable
plan and `CONTEXT.md` for why each decision was made; this file is the
current state and what to do next.

**Last updated:** 2026-09-04 (motion system)
**Repo:** https://github.com/KaiAlan/portfolio-v2 (public, MIT)
**Local:** `/home/kaialan/portfolio-v2` (WSL2; moved off `C:\home\claude-projects\portfolio` on 2026-09-03)

---

## What this is

A cosmos.so-style portfolio: one full-bleed masonry feed of shots, a
lightbox/detail view, a separate Shop page of external-link cards, and
later a private `/admin` studio. **No case studies — everything is shots.**
A project is a wrapper around one or many shots.

Content lives in Contentful; the site reads it. That is the whole point —
the previous portfolio kept content in `/data` in git, so every update
meant editing code.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, **Cache Components on** |
| Styling | Tailwind v4, tokens in `app/globals.css` |
| Motion | `motion` v13 (`layout`, `layoutId`) |
| Content | Contentful Free — space `9rjwe263zoym`, env `master` |
| Images | Contentful Images API (**not** `next/image` — see below) |
| Video | Cloudflare R2 at `cdn.kaialan.com` — **not set up yet** |
| Host | Vercel Hobby — **not set up yet** |

---

## Done

### P0 — Foundations
- Contentful space live with four content types: `project`, `shot`,
  `shopItem`, `siteSettings`. Created by `npm run setup:contentful`,
  which is idempotent (re-run prints `updated`).
- 30 test projects / 88 shots seeded via `npm run seed`. The space holds
  **104 shots** as of 2026-09-04 — the extra ones were uploaded through the
  studio. Audited that day: 0 shots unlinked from a project, 0 assets
  unreferenced by a shot.

### P1 — Portfolio
- `lib/contentful.ts` — every CDA read behind `use cache` + `cacheTag` +
  `cacheLife('days')`. Tags: `projects`, `shop`, `settings`.
- `lib/media.ts` — the single `mediaUrl()` chokepoint.
- Masonry feed, category filters, cards with video.
- `/work/[slug]` detail with metadata rail; all 30 prerendered.
- Intercepting-route lightbox at `app/@modal/(.)work/[slug]`.
- `/shop`, `robots.ts`, `sitemap.ts`, `loading`, `not-found`.
- **P1.8** — nav rebuilt as three pieces with one job each: `primary-links`
  (routes), `category-links` (the filter — was `filter-tabs`, wrongly living
  in the feed), `profile-card` (the hover → about overlay P1.8 asked for:
  bio, socials, a quote). Bar hides on scroll down via
  `hooks/use-hide-on-scroll.ts`. Lightbox got `lightbox-context.ts` instead
  of prop-drilling, a two-phase close (media unmounts first so the morph can
  run before the route actually changes), and a module-level mount counter
  so arrow-keying between projects doesn't replay the panel's slide-in.
  Done 2026-09-03 on its own branch (`feat/nav-lightbox-polish`, off `main`
  — the work predated the studio and was uncommitted through all of P3),
  merged into this branch same day. **`profile-card.tsx`'s bio is
  placeholder copy** (`TODO(kai)` in the file) — write it before launch.
- **Nav music player** — a pill in the header: circular cover art, title,
  artist, prev/play/next, tinted with the colour of what's playing. Design
  and reasoning in
  `docs/superpowers/specs/2026-09-03-nav-music-player-design.md`.

  Audio is a **public YouTube playlist through a hidden IFrame player**, not
  self-hosted files. That sidesteps R2 (still blocked), puts the licence on
  YouTube, and lifts the catalogue limit. Same architecture `salon.wtf` and
  `deluxsalon.in` use. The trade — YouTube's terms want a *visible* player —
  was made knowingly: the player is a real 200×200 box kept in flow, hidden
  with `opacity-0`, not collapsed to nothing.

  **No new content type and no per-track admin.** One `youtubePlaylistId`
  field on `siteSettings`, edited on the studio's **Music** tab; the field
  takes a pasted link as readily as a bare id. Songs are added, removed and
  reordered on YouTube itself — one source of truth for that list.

  `MusicProvider` mounts in the **root layout** (`app/layout.tsx`). It briefly
  lived in `(site)/layout.tsx` on the reasoning that the studio has no player
  and a hidden YouTube iframe had no business inside `/admin` — but the pill
  lives in `Navbar`, which the studio renders too, so `useMusic()` returned
  null there and the pill rendered nothing. One provider above both subtrees
  beats a second one inside the studio, which would mean two players fighting.
  Moved 2026-09-04 (`7c2e0f0`).

  What that buys, precisely: playback survives every *client* navigation — the
  feed, into a project, between studio tabs. It does **not** survive
  site → `/admin`, because nothing links the two, so that is a fresh document
  load. Hoisting cannot fix that and is not meant to.

  Live playlist: **"Everyday Vibes"** (`PLbEn9f2FZ8Rk`). Note that id is 13
  characters, not the usual 34 — `parsePlaylistId`'s pattern is deliberately
  loose for exactly this reason. Don't "fix" it by asserting a length.

### New project: canvas, drop zone and bulk import (2026-09-04)

`/admin/projects/new` was one narrow column of fields with the whole right half
of the screen empty, and no way to add images until after the first save. It is
now two columns with a working canvas, and the drop can create either one
project or many.

- **Layout is MIRRORED from the editor on purpose** — fields left (a fixed
  `32rem` track), canvas right. The editor is canvas-left/form-right, so the
  work visibly swaps sides when Save redirects into it. That was Kai's explicit
  call over the alternative (match the editor, leave the empty half on the
  right, which is where the eye already is when you start typing). The comment
  in `project-editor.tsx` says so, so it does not read as an oversight. Flipping
  the editor to match is a one-line grid change if it ever grates.
- **`hooks/use-uploader.ts`** — the concurrent upload engine, lifted out of
  `drop-zone.tsx` because two callers now need it and disagree only about what
  happens next: the editor attaches to a project, the new page holds. `DropTarget`
  and `FileList` are exported from `drop-zone.tsx` for the same reason.
- **`shots-strip.tsx` is reused unchanged.** It was already controlled and
  presentational, so it does not care that the new page's shots have no server
  behind them — every callback is local there where the editor's are actions.
  `ShotCanvas` could NOT be reused: every one of its actions takes a `projectId`.
- **The pending cover is just `shots[0]`.** `saveProject` writes
  `coverShot: shots[0]`, so "set as cover" moves the shot to the front rather
  than tracking a second piece of state the screen and the save could disagree
  about.

**Bulk import.** Drop N files, then choose — with the count in front of you —
between one project with N shots and N projects with one shot each. Deciding
after the drop rather than via a mode toggle set beforehand.

- `lib/admin/bulk.ts` (pure, 14 unit tests) derives a title from each filename
  and plans every slug **before anything is written**. This is the load-bearing
  part: `slugExists` asks Contentful one slug at a time and therefore cannot see
  a collision between two files in the SAME batch — neither entry exists when
  the other is checked — so two files called `hero.png` would have produced two
  projects both claiming `/work/hero`. `planProjects` takes the whole space's
  slugs and the whole batch at once and suffixes from `-2`.
- Title casing capitalises only the FIRST letter. Title-casing every word turns
  "iPhone mock" into "IPhone Mock"; whatever case the filename carries is the
  author's.
- Category and Featured are inherited from the form; everything else is filled
  in per project afterwards. All created as **drafts** — bulk import gets work
  into the studio, not onto the site.
- Partial failure is tolerated, never rolled back: 20 files where 3 fail leaves
  17 projects and a named list of the 3, the same call `DropZone` makes.

**`discardAssets`** was added because uploading happens on drop — it has to, the
upload route is what validates the image — so a shot removed from the canvas
before saving has *already* been created and published in Contentful. Removing
it from the client array alone would leave it against the 50 GB/mo bandwidth cap
with nothing pointing at it. Safe only because these assets are unattached by
construction; `deleteShot` still owns the attached path and its
`assetInUseElsewhere` check.

**The remaining hole, stated rather than hidden:** upload images on the new-project
page and then *navigate away* without saving, and those assets stay in Contentful
unlinked. `discardAssets` covers removing a shot and Clear, not abandoning the
page. This was observed for real during verification — 6 orphans accumulated from
two abandoned browser runs and had to be swept manually. It is recoverable (they
are visible in Contentful) and the asset library that would surface them is
already on the deferred list.

**Verified end to end, against Contentful rather than the screen.** Clean build;
95 unit tests; headless Chromium driving both paths after a real login. Single
path: 3 files → cover promoted to the third shot in the UI → Save → the created
entry read back from Contentful with 3 shots, `coverShot === shots[0]`, and the
`500x500` shot first, proving the UI reorder survived the save. Bulk path: a
non-default category and Featured set on the form, 3 drafts created, each with
one shot and a cover, all inheriting `Creatives`/`featured=true`, none published.
Then the bulk run was **repeated against a space that already held those slugs**
and produced `-2` suffixes with zero duplicates. All 7 projects, 9 shots and 15
assets were then deleted; the space is back to its 30 / 104 / 104 baseline.

**Not verified**: how it feels, and the failure paths (a mid-batch CMA error, a
rate limit) were reasoned about and unit-tested but never actually triggered.

### Motion system (2026-09-04)

Motion was the one design axis with no tokens — colour, radius, shadow and type
were all tokenised with reasons, while motion was ~30 bare `transition-*` classes
and nine unrelated ad-hoc durations. **`docs/MOTION.md` is now the law and
`CLAUDE.md` points every session at it.** The sourced research behind it is
`docs/superpowers/research/2026-09-04-motion-design.md` (read against the
installed `motion@13.1.1`, not the docs site — they disagree).

- **Tokens in `globals.css`**: `--ease-standard|entrance|exit|overshoot` (IBM
  Carbon's productive curves — M3's `emphasized` is a two-segment SVG path and
  cannot be a CSS `cubic-bezier()` at all) and `--dur-instant|fast|base|slow|
  page|ambient` plus a `-out` variant of each at 0.7×.
- **Tailwind's defaults are overridden**, not worked around.
  `--default-transition-duration` and `--default-transition-timing-function`
  ship as `150ms` and `cubic-bezier(0.4, 0, 0.2, 1)` — the latter is literally
  `ease-in-out`, so every bare `transition-*` in the app was easing *in* as well
  as out and read as lagging the pointer. Overriding the two tokens fixed all
  ~30 at once. **A bare `transition-colors` is now correct by default**; only
  add `duration-`/`ease-` where the element genuinely differs.
- **`lib/motion.ts` is a preset library**, not three constants.
  `spring.morph|sheet|chrome|toggle|release|scroll`, `tween.fade|exit|backdrop|
  popoverOut`, `gridStagger()`, `dampHalfLife()`, `settleMs()`. Several presets
  have no consumer yet — they are vocabulary, the same way `--dur-instant` and
  `--ease-overshoot` are.

**Four real bugs fixed, not just a restyle:**

1. **The morph's corners were squashing.** Motion corrects `borderRadius`
   through a layout animation as a *percentage* to avoid a repaint per frame,
   and that correction **only fires for an inline `style` or an animated value
   — never for a CSS class**. Both ends carried `rounded-card` as a Tailwind
   utility, so it never fired. Now inline on both (`project-card.tsx`,
   `shot-media.tsx`). Same rule applies to `boxShadow`. This is the single most
   likely cause of any future "why does the morph look wrong".
2. **Two different springs inside one card.** The wrapper's `layout` ran at
   `{350, 40}` while its own `layoutId` child ran `MORPH_SPRING` `{460, 42,
   0.8}` — exactly the mismatch `lib/motion.ts` warned about in its header. Both
   now use `spring.morph`, and the wrapper is `layout="preserve-aspect"` so a
   filter re-flow degrades to position-only rather than distorting.
3. **The studio's drag auto-scroll was frame-rate dependent.**
   `use-drag-autoscroll.ts` advanced `scrollTop` by 22px **per frame**, so the
   same board scrolled 1320px/s at 60Hz, 2640px/s at 120Hz and 3168px/s at
   144Hz. Now px-per-second integrated against a clamped `rAF` delta. The clamp
   matters: a backgrounded tab resumes with a multi-second `dt` and would
   teleport the panel.
4. **`CLOSE_MS` was a hardcoded 300 with no reference to the spring driving the
   close.** Now `settleMs(spring.morph.visualDuration)`, so retuning the spring
   cannot silently desync the URL from the screen.

**`prefers-reduced-motion` is handled for the first time** (WCAG SC 2.3.3 — it
means *reduce*, not remove). Two halves, both needed: `MotionConfig
reducedMotion="user"` in the root layout, which makes Motion skip transform and
layout animations while leaving opacity and colour animating; and a CSS block in
`globals.css` for everything Motion never sees — `animate-pulse`, plain CSS
transitions, the YouTube iframe. The CSS uses `0.01ms` rather than `0` so
`transitionend` handlers still fire.

**Two design decisions were deliberately NOT overwritten by the research**, and
both carry the reasoning inline so they don't get "corrected" later:

- **The backdrop stays at 120ms**, not the ~400ms wash general guidance suggests.
  The cosmos.so reference has the feed already blurred on the frame after the
  click — the blur is the context switch and lands *before* the morph, so the
  morph is unambiguously the subject. 400ms makes them two co-equal events.
- **The morph stays fast.** The old hand-tuned `{460, 42, 0.8}` works out to
  ζ = 1.095 and a ~152ms settle. `visualDuration: 0.2, bounce: 0` reproduces
  that at ~153ms, so it is the same feel in the parameterisation you can
  actually reason about — *not* a retune. The generic recommendation was 0.45s,
  which would be 2.5× slower and lose the thing the reference was chosen for.

**Verified**: `rm -rf .next && npm run build` clean first try; the emitted CSS
checked for the token definitions, the Tailwind overrides, the
`duration-(--dur-*)` utilities and the reduced-motion block; headless Chromium
pass in **both** normal and `reducedMotion: 'reduce'` contexts — poster
transition `0.28s` vs `1e-05s`, inline `borderRadius` resolving to `4px` at both
ends, lightbox open → arrow-key → Escape → feed interactive again, zero console
errors.

**Still unverified**: how any of it *feels*. A scripted run proves the numbers
resolve, not that the morph reads well. Judge live — that is still item 2 under
"Next session".

**Noticed, not fixed, not caused by this work:** two `[role="dialog"]
aria-modal="true"` elements linger in the DOM after the lightbox closes (one per
project visited via arrow-key). They are inert — `pointer-events-none`, feed
clickable — and it follows from Next keeping the modal slot mounted from its
client cache, which `lightbox.tsx` already documents. It is an accessibility
smell rather than a motion one, and it wants its own look.

### P3 — The studio (v1, localhost-only)
Built against `docs/superpowers/plans/2026-09-03-admin-studio.md`, all 14
tasks complete. **Not deployed and not deployable as-is** — see the warning
below.

- **Auth**: password + `iron-session`, gate lives in `proxy.ts` and decrypts
  the cookie before the response streams (presence-only checking let a
  forged cookie through — see the comment there). Rate-limited login.
  **No TOTP / recovery codes** — deliberately deferred, and the reason it
  stays localhost-only.
- **Shell**: `app/admin/(studio)/` — a dark frame around the site held as a
  light panel, with the *real* `Navbar` inside it, so what you edit is
  visibly what ships. Navigation is a centred segmented control (`studio-tabs`):
  **Projects · Order · Shop · Music**. It replaced a sidebar.

  **The panel is the scroll container, and much depends on that.** The frame
  is one viewport tall, the toolbar a fixed 40px, the panel takes the rest and
  scrolls internally (`min-h-0` + `overflow-y-auto`). Two bugs came from it
  *not* being one: the panel's rounded top scrolled away leaving a square
  sticky header as the visible edge, and `--studio-chrome-h` was measured from
  the viewport while its own comment claimed otherwise, so it was 40px short
  and every board header overlapped the nav. If sticky offsets inside the
  studio ever look wrong again, check this first.
- **Project form**: all fields, drafts save without publishing, optimistic
  locking on `sys.updatedAt` (not `version` — the Preview API never returns
  it). `null` clears a field, `undefined` leaves it alone; the form must
  emit `null` for an emptied input or the old value silently survives a save
  that reports success.
- **Upload**: `app/api/admin/upload/route.ts` — bytes through a Route
  Handler (Server Actions cap bodies at 1 MB), Contentful CMA only.
  Validates real image dimensions *before* publishing and bins anything that
  isn't an image, so a bad drop can't leave junk assets against the 50 GB/mo
  bandwidth cap. R2 is not wired in — video stays out of the UI.
- **Bulk drop + reorder**: drop many files at once, per-file status,
  partial-failure tolerant; native drag-and-drop (no library) to reorder
  shots and choose the cover.
- **Publish/unpublish**: walks shots → their image assets → the shots → the
  project, so nothing goes live half-linked.
- **Order panel** (`/admin/order`): drag-reorder live projects, one
  `siteSettings.projectOrder` write on Save — never per-entry, never 80
  writes. `lib/admin/order.ts` now also exports `applyOrder`, a pure copy of
  the private sort in `lib/contentful.ts` kept deliberately in step with it
  (that file is never touched — see Traps below) so the order panel shows
  the same sequence the site will render, not newest-first.
- **Cache invalidation**: every mutation calls `updateTag`, never bare
  `revalidateTag` (deprecated without a profile in this Next version).
- **Boards**: Projects and Order share one `ProjectCard` and `ProjectGrid`, so
  they cannot drift into two slightly different cards, and a `ColumnPicker`
  (1–8, stored) that both read. Both apply `applyOrder`, so the studio shows
  the sequence the feed serves rather than newest-first; drafts aren't in
  `projectOrder`, so they rank last.
- **Drag auto-scroll** (`hooks/use-drag-autoscroll.ts`): native HTML5 drag does
  not reliably auto-scroll a nested scroll container, so cards could only be
  moved among rows already on screen. Used by the order board and the shots
  strip.
- **The project editor is two columns** (`/admin/projects/[id]`): the work on
  the left as a `ShotCanvas` — one shot large, thumbnails wrapping under it —
  and the controls on the right, drop zone on top. `ShotCanvas` owns the shot
  state and all three shot actions; `shots-strip.tsx` is presentational and
  handles drag only. A click on a thumbnail now *previews* it, so setting the
  cover moved to its own hover control, next to a delete one. Dragging draws a
  line in the gap the card would land in — on the target's trailing edge when
  moving right and its leading edge when moving left, because `moveItem`
  removes the card before re-inserting it. That is the easiest detail here to
  get subtly backwards.

  The **hero** carries a fixed height (`--studio-hero-h`), sized so it, the
  hint line and the first row of thumbnails all clear the fold; the strip below
  wraps to as many rows as it needs and the panel scrolls. A height at every
  width, never an aspect ratio — an aspect-ratio hero is as tall as the column
  is wide, so a narrow window *or merely browser zoom* pushed it off screen.
  Note `--studio-hero-h` counts the dark toolbar and `--studio-chrome-h` does
  not: they are measured against different boxes. The token's comment carries
  the arithmetic, so changing any of that chrome means changing it.

  Hero arrows step through the shots and prefetch the two neighbours — each
  `?w=1200` variant is rendered by Contentful on first request, so without the
  prefetch every step visibly waited on that render.

  Save/Publish/Unpublish live in the **page header**, on the title row beside
  the back button — not under the last field, where the actions taken most
  often were the ones furthest away. That is why `project-editor.tsx` is one
  client component covering header *and* form: the buttons need `pending` and
  the publish transition, and the header spans the full width above the
  columns, so the `<form>` element cannot contain it. The buttons reach the
  form with `form="project-form"` — a submit button may live anywhere in the
  document as long as it names its form. **Verified that this really drives
  React 19's `action={formAction}`**, by editing a field through the header
  button and reading the change back from Contentful; it is not obvious that an
  external submitter would, so don't "fix" it into a ref and a synthetic
  submit. `project-fields.tsx` is the inputs alone, so the file holding the
  save/publish state is not also the file with ten inputs in it.

  Publish is the one coloured button (`--color-live`), because publish state is
  the single fact in this system worth spending a colour on and Publish is the
  action whose effect reaches the public site. Save draft stays neutral, and
  Unpublish stays a ghost so it is never what your eye lands on first.
- **Buttons get `cursor: pointer` from a base rule in `globals.css`.**
  Tailwind v4's preflight does not set one (verified in its `preflight.css`),
  and the browser default for `<button>` is an arrow — so every button in the
  app read as inert. Fixed once globally rather than per component.
- **Deleting a shot** (`deleteShot`) unlinks it, then destroys the shot entry
  and its image asset. Confirmation happens under the hero at full size, not on
  the 112px thumbnail. Three things about it are load-bearing:

  **Unlink first, destroy second.** A failure after the unlink leaves an
  orphan, which is recoverable; the reverse leaves a live project pointing at a
  deleted entry, which is not. Anything failing after the unlink is reported as
  a *warning*, never an error — the shot is gone from the site either way, and
  retrying would re-run an unlink that already succeeded.

  **The cover forces a republish, and nothing else does.** This is the one
  studio action that reaches the public site without going through Publish.
  Deleting an ordinary shot from a live project needs no republish: the
  published version keeps a dead link and `.withoutUnresolvableLinks` drops it.
  The cover is different — `toProject()` discards any project whose cover will
  not resolve, so a published project pointing at a deleted cover **vanishes
  from the feed entirely**. So the promoted cover is published, and since
  publish is per-entry, unpublished draft edits to that project go live with
  it. The confirm copy says so when it applies. Do not "simplify" this into
  always- or never-republishing; both are wrong in one direction.

  Cover promotion lives in `lib/admin/shots.ts` (`removeShot`, unit-tested) and
  the client uses the same function for its optimistic update, so the screen
  and Contentful cannot disagree about which shot takes over.
- **New project is no longer a bare form.** See "New project: canvas, drop
  zone and bulk import" above — it has its own two-column layout, a drop zone
  that works before the project exists, and a bulk path.
- **Shop tab is a deliberate stub.** The tab exists so the studio's navigation
  doesn't grow a hole later, but `shopItem` entries are still edited in
  Contentful directly. Wiring it up needs the same form, upload and publish
  walk projects got — that is its own task, not a restyle.
- **Music tab**: the `youtubePlaylistId` field. See the player under P1.

**Verified for real, not by inspection** — a disposable `test-e2e-verify`
project was created, given 4 real uploaded images, published, and deleted;
an existing seeded project's video-bearing shot was confirmed to survive an
unrelated project-level edit untouched; the reorder write was confirmed
against Contentful directly and reverted. `npm run build` was also run once
clean (`rm -rf .next && npm run build`) and the client bundle grepped for
`CONTENTFUL_MANAGEMENT_TOKEN`, `ADMIN_PASSWORD` and `SESSION_SECRET` — none
present.

**The project editor has since had a real browser pass (2026-09-04)** — see
the shot-deletion and editor-layout entries below. Upload, publish, both
delete paths, the hero arrows, the drag drop-indicator and the header's Save
draft were all driven through the UI in headless Chromium and checked against
Contentful rather than against the screen. **Still unverified by eye**: upload
*progress* on a slow connection, how the drag actually feels, and the studio's
dark theme as a piece of design — a scripted click proves a mechanism works,
not that it looks right.

**⚠ Do not deploy `/admin` yet.** Auth is a single password behind a
session cookie — sufficient for localhost, not for the public internet.
TOTP + recovery codes are required first (see Deferred, P3 plan). The repo
is also still **public** with this auth code now pushed to it; decision #4
in `PLAN.md` said to flip it private before auth landed, and that has not
happened.

**Deferred, with reasons, not gaps:** Cloudflare R2 / presigned uploads /
video flow (no card on file yet); TOTP + recovery codes + login rate
limiting beyond what exists (required before any public deploy); the asset
library (search, copy-URL, browsing — out of v1 scope; note deleting a shot
now takes its asset with it, so orphans no longer accumulate); Shop CRUD
(out of v1 scope); `scripts/encode.mjs`.

---

## Not done

**Blocked on account setup (Kai's, not code):**
1. **Cloudflare R2** — **BLOCKED: no card on file.** R2 requires one even
   though the free tier bills $0. Until then there is no `cdn.kaialan.com`
   and no video pipeline. Then bucket `kaialan-media`, usage alert, CORS
   (`PUT` from the dev origin), and `R2_*` vars in `.env.local`.
2. **Domain** — **DONE 2026-08-26.** `kaialan.com` nameservers moved
   Porkbun → Cloudflare (`noor`/`pete.ns.cloudflare.com`). Verified after
   cutover: apex `A 216.198.79.1` and `www CNAME
   3cc1f46ef4b0e5b6.vercel-dns-017.com` both **unproxied / grey cloud**;
   MX pair (`fwd1`/`fwd2.porkbun.com`) intact so Porkbun mail forwarding
   still works; SPF + Google + Pinterest TXT intact; 6 `_acme-challenge`
   TXT intact. v1 still serves — apex 307 → `www` 200, TLS clean.
   `cdn.kaialan.com` does **not** exist yet (waits on R2).
   Note: the grey-cloud rule applies only to the Vercel records. An R2
   custom domain **must** be proxied — that is how the bucket is served.
3. **Vercel** — link the repo, set env vars. v1 is currently live on this
   domain; v2 does not take it over until we repoint deliberately.

**The real launch blocker is content, not code.** All **30 projects are
`test-` fixtures — zero real** (verified against Contentful 2026-09-03).
Images are LoremFlickr, videos are public sample MP4s. Everything below is
small next to writing and entering the actual work.

**Code remaining:**
- P1.9 — OG images (`opengraph-image.tsx`), richer metadata. Not started.
- P1.8 leftover — `profile-card.tsx`'s bio is still `TODO(kai)` placeholder
  copy.
- P2 — deploy; replace fixtures with ~15 real projects.
- P3 hardening — TOTP + recovery codes, before `/admin` can ever be public.
  See "P3 — The studio" under Done for what already shipped.
- Shop CRUD — the studio's Shop tab is a stub; shop items are still edited in
  Contentful directly.
- P4 — bulk-import the remaining ~55 projects.

---

## Unverified

**Opened in a browser for the first time on 2026-09-03** (headless Chromium,
scripted, not eyeballed live) — feed, category filter, card → lightbox open,
refresh-inside-lightbox → full detail page, back-navigation, admin login,
projects list, and the order panel all work. No console errors on any of
those. Two things surfaced, neither a regression from P3 work — both
predate it:

- **`app/@modal/(.)work/[slug]/page.tsx` (`WorkModal`) tripped a Cache
  Components warning** — **fixed 2026-09-03**. `params`/`searchParams` were
  read with no Suspense boundary and no `instant` declaration, so every open
  logged "Route ... encountered runtime data during prerendering or a
  navigation." Two changes: `app/@modal/layout.tsx` now wraps the slot in
  `<Suspense fallback={null}>` — it has to live in the *layout*, not the
  page, because the page is keyed by `[slug]` and a boundary there would
  remount (and blink) on every prev/next. That alone didn't silence the
  warning — Next's own guide (`node_modules/next/dist/docs/.../instant-
  navigation.md`) confirms validation checks the segment itself, not credit
  from an ancestor layout's boundary. So `WorkModal` also carries
  `export const instant = false`: every field this panel shows depends on
  the slug, there's no meaningful static shell, and the project deliberately
  doesn't want a flashing skeleton fallback — exactly the case the docs'
  "Opting out" section describes, and the same call already made for every
  `/admin` page. Verified clean (headless Chromium, zero console errors,
  arrow-key prev/next still works) after a full `rm -rf .next && npm run
  build`.
- **Fixture videos fail to load under ORB** (`net::ERR_BLOCKED_BY_ORB`) —
  both sample URLs (`test-videos.co.uk`, `commondatastorage.googleapis.com`)
  are cross-origin with no CORS headers Chromium will accept for a
  `<video>` source. Fixture-only; resolves once real video is served from
  `cdn.kaialan.com` at P2.

**`feat/nav-lightbox-polish` merged into this branch same day**, then
re-verified the same way: `rm -rf .next && npm run build` clean, headless
Chromium pass with zero console errors across feed, scroll-hide nav, card →
lightbox open, arrow-key switch, `Escape` close (resolves back to `/`, not
stuck mid-close), full-page refresh, category filter, and admin
login/order-panel. One screenshot in that pass showed the lightbox not
rendering on a fresh open — investigated rather than dismissed: the DOM
dialog was present and `visible: true` in Playwright's own accessibility
check at the same timing, and three repeated runs at identical timing all
rendered correctly. Concluded to be a one-off flake in the test script (a
screenshot racing a paint), not a product bug — but flagging the method
here in case it recurs: if `/work/[slug]` ever opens to a bare grid with no
overlay, check `[role="dialog"]` presence and visibility before assuming
the DOM is wrong, since in this instance it wasn't.

Still genuinely unconfirmed: how the morph **feels** (spring tuning,
hitch-or-not) and hover-to-play smoothness — a scripted click proves the
mechanism works, not that it looks right. Judge those live.

---

## Decisions that will look wrong without the reason

**Images bypass `next/image`.** `lib/media.ts` builds Contentful Images API
URLs (`?w=&fm=webp&q=`) used with plain `<img srcSet>`. Contentful already
resizes for free; routing through `next/image` would spend Vercel Hobby's
5K/mo transformation allowance to redo that work. `@next/next/no-img-element`
is disabled in `eslint.config.mjs` for this reason.

**The filter does not use `useSearchParams`.** `hooks/use-category-filter.ts`
reads `window.location` through `useSyncExternalStore` and writes with
`history.pushState`. Reading search params makes the subtree dynamic, and
under Cache Components that ships the Suspense fallback as the static
shell — the feed then contains **zero cards** in prerendered HTML. This was
a real bug, found by grepping served HTML.

**`usePathname` sits behind Suspense** in `components/navbar/navbar.tsx`.
It is a dynamic API under Cache Components and was breaking the prerender
of every route that renders the header. The fallback renders the same
links with no active state, so the nav stays in static HTML.

**Masonry renders a CSS-grid fallback before measuring.** Withholding items
until measured emitted nothing server-side. Measurement is in
`useLayoutEffect`, so the fallback never paints.

**`projectOrder` holds entry IDs, not slugs.** A slug rename would
otherwise silently drop a project to the end. Empty array = newest-first,
so ordering only becomes real when the studio ships at P3.

**Shots missing `width`/`height` are dropped** in the mapper rather than
rendered, because they would collapse the masonry.

---

## WSL2 build networking

The project moved from `C:\home\claude-projects\portfolio` to
`/home/kaialan/portfolio-v2` on 2026-09-03. It builds here, but **`next build`
is intermittently flaky** and the failure looks like a code bug when it isn't.

`next build` prerenders 39 pages with 10 parallel workers, each hitting the
Contentful CDA. WSL2's default NAT networking silently drops some concurrent
outbound connections. Measured: 20 parallel HTTPS requests to
`cdn.contentful.com` → 18 returned 200, **2 hung to a full 25 s timeout**, and
latency rose from ~0.7 s to ~6 s. Sequential requests are consistently fine.

The Contentful SDK retries, so most runs recover and print
`[warning] Connection error occurred. Waiting for ~2000 ms before retrying...`
before finishing. When the retries do not win, the build dies with a **misleading**
error:

```
Error: Filling a cache during prerender timed out, likely because request-specific
arguments such as params, searchParams, cookies() or dynamic data were used inside
"use cache".
    at lib/contentful.ts:203  (getProject)
```

Nothing is wrong with `getProject`. It is a network timeout wearing a
Cache-Components costume. **Do not "fix" `lib/contentful.ts` in response to it.**

Three observed runs on this machine: 1 failed at 19/39, 2 passed (one needed 3
retries). Re-running the build is usually enough.

**The real fix** is Windows-side — mirrored networking, which replaces the NAT
layer. Create `C:\Users\SATYAJIT\.wslconfig` with:

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
autoProxy=true
```

then `wsl --shutdown` from PowerShell and reopen the shell. There is no
`.wslconfig` on this machine yet, so the default NAT mode is in effect.

**If you need one reliable build without touching Windows**, raise the retry
budget temporarily — do not commit it, since it is a local-network workaround
and Vercel's builders do not have this problem:

```ts
experimental: { staticGenerationRetryCount: 3 }
```

---

## Known limitation

`/work/<unknown-slug>` returns **200, not 404** — correct not-found UI,
wrong status. Per Next's own docs, Cache Components streams a static shell
first, so the status cannot change once streaming starts. Next injects
`noindex` automatically. A real 404 needs the slug checked in `proxy.ts`
**before** the response streams. `dynamicParams = false` also fixes it but
freezes valid paths at build time, which would break P3's
publish-without-rebuild loop — so it is the wrong fix here.

Tested and **refuted** as causes: the `@modal` parallel slot, the dynamic
hole in the shell, a segment-level `not-found.tsx`.

---

## Fixtures

The 30 projects are **not real work**. Images come from LoremFlickr by
subject tag; videos point at public sample MP4s. Everything is marked —
project slugs start `test-`, shot captions and asset titles start
`[test]` — so `npm run seed:clean` removes all of it before real content
goes in at P2. It deliberately leaves `siteSettings` alone.

---

## Traps already paid for

- **Vercel caps request bodies at 4.5 MB on every plan.** Uploads must be
  presigned direct-to-R2; for Contentful images, stage to R2 then hand the
  CMA the external URL so it pulls the bytes itself.
- **Contentful's 50 GB/mo asset bandwidth is a hard cap** — delivery APIs
  pause until the 1st. The only limit that can take the site offline.
  Projection is ~10 GB (20%). Re-check monthly for three months.
- **`r2.dev` is rate-limited** and unsuitable for production → custom
  domain → DNS must be on Cloudflare.
- **GIF is 6–10× larger than equivalent MP4.** Never use it for loops.
- **`contentful-management` v12 is plain-client only.**
  `createClient(...).getSpace()` no longer exists.
- **Contentful PATs need an organization access grant.** A token can pass
  `/users/me` and still 401 everywhere with
  `OrganizationAccessGrantRequired`; tell-tale is `GET /spaces` →
  `total: 0`.
- **`applyOrder` exists twice, on purpose.** `lib/contentful.ts` (the public
  read path) and `lib/admin/order.ts` (the studio) each have their own copy
  of the same sort. `lib/contentful.ts` is never modified by studio work —
  that is a hard rule in the P3 plan — so the studio couldn't import the
  original. If the ordering rule ever changes, change both.

---

## Next session

The site and studio are built. What stands between here and launch is
mostly not code.

1. **Real work into Contentful.** All 30 projects are fixtures. The studio
   exists precisely so this no longer means editing code — enter ~15 real
   projects through it. As of 2026-09-04 it can add, reorder, cover, publish
   *and delete* shots, so entering real work is no longer blocked on tooling.
   This is the long pole; everything else is an afternoon.
2. `npm run dev` and judge the motion by eye — scripted Chromium confirms the
   morph, the lightbox and the player *work*, not that they feel right.
3. Write the profile card's bio (`TODO(kai)`), and confirm the social handle
   in `navbar.tsx:29`, which is a guess.
4. Then, in whatever order suits: P1.9 (OG images) to close out P1, TOTP to
   make `/admin` safe to deploy at all, Shop CRUD, or the account setup that
   unblocks P2 (R2's card, then Vercel).

**Deliberately not done in the editor**, so it does not read as an oversight:
the hero is not sticky while the form scrolls. Sticking it at `top-0` would
slide it under the panel's own sticky nav, and the panel-as-scroll-container
has already produced two bugs (see the Shell entry) — it wants a deliberate
pass, not a class bolted onto other work.

**Before the site goes public**, two things deliberately deferred rather than
forgotten:
- Flip the repo private (plan decision #4) — P3 auth code is on GitHub.
  `gh repo edit KaiAlan/portfolio-v2 --visibility private
  --accept-visibility-change-consequences`
- TOTP + recovery codes. `/admin` is one password today; that is fine on
  localhost and not fine on the internet.
