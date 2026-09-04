# Handoff — kaialan.com v2

Written for a session starting cold. Read `PLAN.md` for the full executable
plan and `CONTEXT.md` for why each decision was made; this file is the
current state and what to do next.

**Last updated:** 2026-09-04 (feed views, Settings board, studio island)
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

### Deleting a project, and the "Live" lie it uncovered (2026-09-04)

A project can now be deleted outright, gated behind unpublishing it first.

**The gate needed a fix before it could exist.** `unpublishProject` does not
Contentful-unpublish anything — it sets `fields.published = false` and
*publishes that change*, deliberately, so the entry stays resolvable by the CDA
for anything still linking to it. But `publishState()` derives from
`sys.publishedVersion`/`publishedAt`, so it still returned `'live'` afterwards.
**The studio was showing "Live" for projects that were off the site**, and kept
offering Unpublish on something already unpublished. Nothing tracked
`fields.published` at all — it was on neither `AdminProject` nor the editor.

`visibleState(sys, published)` in `lib/admin/publish-state.ts` resolves the two
axes and adds a fourth state, **Hidden** (neutral pill — hiding is reversible,
and red here is reserved). `publishState` is deliberately left alone: its other
caller, `deleteShot` deciding whether a promoted cover needs republishing,
genuinely means the Contentful axis, and a hidden project *is* still published
there.

Knock-on fixes from surfacing the flag:
- The **Order board** now filters `p.published && p.state !== 'draft'` rather
  than `!== 'draft'`, so hidden projects no longer appear on a board that
  arranges the feed they are not in.
- **ShotCanvas** computes `isLive` with `isOffSite()`, so deleting a shot from
  a *hidden* project no longer warns that it "leaves the site straight away".
- `boardOrder` lifts drafts only. A hidden project keeps its rank, so
  republishing it puts it back where it was.

**The delete itself** (`deleteProject`) mirrors `deleteShot`'s hard-won rule one
level up: **unlink first, destroy second, project last.** Emptying `shots` and
`coverShot` before touching anything means a failure partway leaves orphaned
shot entries — invisible and recoverable — rather than a project pointing at
records that are gone. Deleting the project first would strand every shot under
it with no way to find them. Image assets are collected BEFORE their shots are
destroyed, because once a shot entry is gone nothing says which image was its.
Anything failing after the unlink is a warning, never an error. No republish is
needed (unlike deleteShot's cover case): an off-site project is not in
`getProjects()` at all.

**The gate is enforced server-side**, not just by hiding the button — the action
re-reads the entry and refuses if `fields.published === true`.

**Red is the second non-neutral pair, and the exception to the rule** in the
`--color-live` block. `--color-danger` / `--color-danger-ink` (5.13:1, clears
AA) is reserved for irreversible destruction only. It is **not** shadcn's
`destructive` variant, which stays mapped to ink so nothing picks up red by
accident; the Button has its own explicit `danger` variant. Unpublish stays a
ghost because it is undoable. If a third thing ever wants red, it almost
certainly wants ink.

**Verified** against a production build, driving the real UI: a disposable
project with 2 shots was created, and the button set was read at each stage —
draft (Delete offered), published (Delete hidden, Unpublish offered), unpublished
(Delete offered again, proving `visibleState` reports Hidden). The confirm named
"its 2 shots and their images", Cancel dismissed it, and Delete removed the
project. Checked in Contentful afterwards: the entry returns NotFound, zero
`zz-test` assets remain, and an orphan audit shows **109 shots, 109 linked, 0
orphaned**.

### shadcn adopted, and three bugs it surfaced (2026-09-04)

`components.json` had been sitting in the repo since `3e9360e` — shadcn was
**initialised and then never used**. No Radix, no CVA, no primitives; every
input was a raw `<input>` with hand-written Tailwind, and the category and
Featured controls were unstyled browser chrome. That is what made the studio's
forms look cheap, and it was measurable rather than a matter of taste: the
input border was `--color-card-edge` at **1.19:1** against the white panel, and
focus set `outline-none` with a border change to **1.54:1** — i.e. no visible
focus indicator at all, a WCAG 2.4.7 failure as well as an ugly one.

- **Primitives are real shadcn** (`button`, `input`, `select`, `checkbox`,
  `label`, `textarea`), generated by the CLI and then adapted to the design law
  rather than left as-is: pill buttons, 4px fields, the repo's own type scale,
  and every `dark:` variant stripped since the site is light-only by decision #8.
- **One palette, not two.** A token bridge in `globals.css` aliases every
  shadcn variable onto the existing tokens, so `bg-primary` and `bg-ink` are the
  same colour by construction. Two flattenings are deliberate: `destructive`
  maps to **ink, not a red**, because the design law allows exactly one
  non-neutral pair (`--color-live`); and `border` and `input` are **different
  tokens**, because structural rules want the quiet hairline while a control you
  type into wants a visible edge. Shipping them as one value is what makes
  stock shadcn wash out on a light ground.
- **New `--color-field` / `--color-field-edge`.** `#f5f5f5` fill and a
  `#949494` border at **3.03:1**, which clears WCAG 1.4.11. Kept SEPARATE from
  `--color-card-edge` on purpose: that one is `#ebebeb` because a feed card
  needs a nearly-invisible hairline, and raising it would change the public feed.
- The Select popover is animated by `--dur-*` / `--ease-*` in `globals.css`
  rather than `tw-animate-css`, whose `animate-in` classes shadcn ships were
  inert here (the package is not installed). One motion system, per MOTION.md.
- Buttons were migrated across the studio **and** the public site (not-found
  pages, lightbox controls, profile card), with a `live` variant reserved for
  Publish.

**Bug 1 — the category filter was clipped.** The navbar's bar is `h-18` (72px);
it grew from 64px in `18f91ae` when the music pill needed the room. The two
things that pin beneath it — the feed's category row and the detail page's meta
rail — kept a hardcoded `top-16`. They sat 8px too high, under a `z-50` header
that painted over their top edge. Now `--nav-h` in `:root`, used by the header
and both followers, so it cannot drift again. **Nothing in the app should say
64 or 72 any more.**

**Bug 2 — new drafts ranked last on the Projects board.** `applyOrder` sends
ids that are not in `projectOrder` to the end, which is right for the feed and
wrong for the board: a project you just made landed below thirty you were not
working on. `boardOrder` in `lib/admin/order.ts` puts drafts first, newest
first. It does **not** break the studio-shows-what-the-site-serves rule, and the
reason is specific: drafts are not on the site at all (`getProjects()` filters
on `fields.published`), so there is no sequence to disagree with, and everything
published still passes through `applyOrder` untouched. The Order board is
unchanged — it excludes drafts entirely, which remains correct.

**Bug 3 — a saved reorder never reached the site. This one was subtle, and the
diagnosis matters more than the fix.**

Symptom: reorder in the studio, the board shows it, the feed serves the old
sequence indefinitely. Ruled out first, with evidence: the two `applyOrder`
copies are byte-identical; the cache tag constants match the `updateTag`
literals exactly; and Contentful's **delivery** API already held the new order.
So the write was fine and the sort was fine — the page was stale.

Two causes stacked, and both had to be fixed:

1. **Contentful's delivery CDN lags a publish by ~1.5–3s** (measured against
   this space: stale at 1.5s and 2.1s, current at 2.9s). Every mutation
   published and invalidated in the same breath, so Next regenerated *inside*
   that window, re-read the old data, and — because `getProjects()` is
   `cacheLife('days')` — re-cached the stale answer for another day. That is why
   it was intermittent and why it then stayed wrong. `awaitDelivery()` now polls
   the delivery API for the entry's `updatedAt` before invalidating.
2. **`/` is a fully static prerender**, and its HTML is its own cache entry
   that does **not** inherit the tags of the `use cache` functions whose output
   it embedded. So expiring the `projects`/`settings` tags invalidated
   `getProjects()` and changed nothing anyone could see. `updateTag` alone never
   worked here, and neither did adding `revalidateTag(tag, 'max')`.
   **`revalidatePath` is what actually fixed it** — proven by A/B against a
   production build.

All eleven mutations now route through one `invalidate()` helper that does all
three: `updateTag` (read-your-own-writes), `revalidateTag(tag, 'max')` (SWR),
and `revalidatePath` for every public route the tag can affect. **Expect the
first request after a mutation to still be stale** — that is stale-while-
revalidate behaving correctly — and every request after it to be current. Do
not "simplify" this back to `updateTag` alone; that is the bug.

**Verified**: clean build, 100 unit tests, headless Chromium against a
production build after a real login. The reorder fix was proven by driving a
real drag on the Order board, saving, and reading the served HTML back — it
failed before the change and passed after, twice. Nav height measured at 72 =
filter sticky top 72. Focus ring confirmed rendering as a 3px ink ring at 20%
plus an ink border. Zero console errors anywhere. The project order was backed
up before testing and **restored afterwards** — the space is as it was.

**Not verified**: the detail-page and sitemap revalidation paths
(`/(site)/work/[slug]`, `/sitemap.xml`) are wired the way the docs specify but
only the feed was driven end to end. They fall back to the 1-day `cacheLife`
either way.

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

### The feed's three views (2026-09-04)

The feed was masonry-only. It now has three, chosen from one popover at the
top-right of the category row (`components/ui/layout-picker.tsx` — shared
with both studio boards, see the Boards entry under P3).

- **Masonry** — unchanged. `MasonryLayout` still packs shortest-column from
  known aspect ratios, still picks its own column count from container width.
- **Grid** (`components/feed/grid-layout.tsx`) — uniform 4:3 cells at a
  user-chosen 2–6 columns, laid out by CSS grid through `.feed-grid` /
  `--feed-cols` in `globals.css`. That is a custom property rather than a
  Tailwind class for the same reason `.board-grid` is: a runtime column count
  has nothing to generate a utility from at build time.

  Each shot sits **contained** inside its cell at its own true ratio with
  40px of padding, so the card's ground shows around it. The contained box is
  `containedWidthFraction` in `lib/feed-layout.ts` (tested) — closed-form
  from two known ratios, not measured, because that box is also the
  `layoutId` morph source and the lightbox's end is the shot's own ratio. A
  morph between two different ratios stretches the media for its duration.

  Known approximation, commented at the call site: the fraction is computed
  against the *unpadded* cell, so subtracting a fixed 40px from both axes
  skews the 4:3 by a few percent. Imperceptible at real cell sizes; fixing it
  exactly would mean measuring every cell.
- **Index** (`components/feed/index-layout.tsx`) — the editorial list.
  `/001 — Title — Category — Year — ↗` per row, inverting to `bg-ink` on
  hover, with the cover floating in beside the cursor. It is the one view
  that shows year and category, being the one not competing with a picture
  for the space. Category and year drop out below `sm` rather than wrapping:
  a row that becomes two lines stops being a row.

  Its preview is sized in JS and clamped to the viewport — see the index-view
  bullet under Boards, which documents why.

**The bug worth remembering here**: the preview began as ONE element kept
mounted while its `layoutId` swapped from project to project as the cursor
moved down the list. Motion reads that as a shared-layout transition *from
the previous shot's box*, so each cover scaled out of its frame mid-move and
read as clipped. Keying the inner node on the project id fixes it — each
cover is its own element, and `layoutId` is left to do only the lightbox
morph. Same class of mistake as the radius-through-a-morph trap.

**Card chrome, both card views:**
- A **shot-count badge**, top-right, only when a project has more than one
  shot — a single-shot project has nothing to count and the badge would be
  noise. On `--color-surface-sunken`.
- The hover title is a **flat white tag** (bottom-left, `rounded-card`, no
  shadow), not the old dark gradient wash. It has to sit on light and dark
  imagery alike, and a gradient washes out on an already-dark shot.

**Token changes, all in `globals.css`:**

| Token | Change | Why |
|---|---|---|
| `--color-on-dark` | `#ffffff` → `#fafafa` | Kai's button contract: dark buttons are `#1f1f1f` and never pair with pure white. One token change covers every dark button in the app. |
| `--color-surface-sunken` | new, `#f0f0f0` | Ground for a small marker sitting ON a card — the count badge. Never for a card itself. |
| `.type-caption` | new, 12px | Slots under `type-meta` (13px). Badge, hover tag, index row meta. |
| `.feed-grid` | new | Grid mode's column template, per above. |
| Feed card ground | `surface-warm` → `surface-alt` (`#f5f5f5`) | The card colour Kai specified. `Skeleton` moved with it — its whole point is being the card's own grey. |

**Buttons floor at 32px** — the category pills and the layout picker's rows
carry `min-h-8`, since `type-button`'s line height alone landed a hair under.

### Settings board, and the studio down to one island (2026-09-04)

**`/admin/music` → `/admin/settings`.** Music was never really its own
section, it was the only setting that existed. A second one made "Music" the
wrong *name* for the tab rather than the wrong place for the field, so the
board was renamed and both now live on it, each saving independently and
explicitly (writing `siteSettings` republishes and waits for delivery — not
something to fire on a keystroke). No redirect stub: it is an authed URL with
no inbound links.

**The feed's default view is now editable** (`DefaultViewField` →
`saveFeedDefaults`, appended to `app/admin/actions.ts` and modelled exactly
on `savePlaylist`). Two new `siteSettings` fields, `defaultFeedView` and
`defaultFeedColumns`, both with `in` validations.

> **Run `npm run setup:contentful` once** to create them. Until then both
> fall back to masonry/3 (`FEED_FALLBACK`) rather than erroring — an entry
> predating the fields simply has neither.

Precedence: the admin default is what a first-time visitor sees; once someone
touches the feed's own picker, their `localStorage` choice wins in that
browser. The default is read on the **server** (`getSiteSettings`, cached and
tagged, so `/` stays fully prerendered) and passed into `Feed`, so it is in
the static HTML — no flash of the wrong view before hydration.

`useFeedLayout` therefore takes its defaults as an argument, which means its
`getSnapshot`/`getServerSnapshot` close over them and **must** stay
memoised — an inline arrow would re-read (and can re-subscribe) every render.
`Feed` memoises the object on its two primitive fields for the same reason.

**The studio's chrome is now one island.** It lost, in that order: the
full-width 40px dark toolbar that held a title and a log-out button at
opposite ends of the screen, and then the dark frame that surrounded the
whole panel. Two words of chrome did not need a band of the viewport, and the
frame around it did not need the rest. What remains is
`components/admin/studio-island.tsx` — a dark shape hanging from the top
edge, flush at the top with only its bottom corners rounded, and the only
element on screen allowed to be dark now that it is the only thing saying
"admin".

- **Collapsible.** At rest it is just `Admin ⌄`. Actions appear on hover, and
  a click *pins* it open — a hover-only reveal is a target that moves away
  from you on the way to the button. Escape or an outside click unpins.
- `layout` on the shape, `layout="position"` on the label, `spring.chrome`.
  Motion animates size by scaling, so a text node in a growing box smears
  without the second one; the third is the documented docking preset.
- **`fixed`, not `absolute`.** The panel is itself the scroll container, so an
  absolutely positioned island would scroll away with the boards.
- It briefly carried concave fillets to melt into the dark frame's top edge.
  Those came out with the frame — with no dark material either side they are
  two smudges on white.

**`--studio-hero-h` is now `calc(100dvh - 320px)`, from 380px.** That token
itemises every pixel above the project editor's hero, and two entries left
the sum: the 40px toolbar (replaced by a fixed island, which costs no layout
height) and the frame's 20px top and bottom padding. The breakdown comment in
`globals.css` was rewritten to match — it is the kind of arithmetic that goes
stale silently.

The `(studio)` layout's own doc comment was also rewritten. It opened with "a
dark frame with the site held inside it as a light panel… the framing is the
whole idea", which is no longer true of anything.

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
- **Boards**: Projects and Order share one `ProjectCard`, one `ProjectRow`
  and one `BoardView`, so they cannot drift into two slightly different
  boards. Both apply `applyOrder`, so the studio shows the sequence the feed
  serves rather than newest-first; drafts aren't in `projectOrder`, so they
  rank last.
- **One layout picker, three surfaces** (`components/ui/layout-picker.tsx`):
  masonry / grid / index, plus the grid's column count. The feed and both
  studio boards render the same control — it replaced the studio's
  numbers-only `ColumnPicker`, which had already drifted from the feed's
  version of the same popover. What differs is passed in: the studio offers
  1–8 columns on a `--control` ground, the feed 2–6 on the page canvas.
  Column count is grid-only (masonry picks its own tiers from container
  width, index is one column), so the number row greys out rather than
  hiding — hiding it made the popover resize as the mode was pressed.
  - State: `hooks/use-board-layout.ts` for the studio (`studio:board-layout`,
    one setting across both boards) and `hooks/use-feed-layout.ts` for the
    site. Separate stores because the feed's defaults come from the Settings
    board on the server and the studio's are constant. Both are
    `useSyncExternalStore` over localStorage, never an effect.
  - The studio's masonry reuses the site's `MasonryLayout` unchanged — it is
    pure geometry over id + aspect, so the board packs columns exactly the
    way the feed does. That needed `AdminProject.coverAspect`, read off the
    same resolved cover entry as `coverUrl` (`lib/preview.ts`); a cover with
    no dimensions falls back to 4:3 rather than being dropped.
  - A masonry tile carries its title and status pill ON the cover, not under
    it: a meta row below would have to be packed for too. Grid keeps the
    contained 4:3 tile with the meta row.
  - **The index view's hover preview is sized in JS**, not CSS
    (`previewSize` / `previewPlacement` in `lib/feed-layout.ts`, tested).
    Measured in a real browser over CDP, not reasoned about — the cascade
    theory that prompted the rewrite turned out to be wrong. Two real
    reasons:
    1. A CSS width cap cannot take the height down with it. `h-[360px]` +
       `aspect-ratio` + `max-w-[38vw]` sized ordinary shots correctly, but a
       3:1 panorama wants 1560px against a 608px cap, and the box then stops
       being the shot's ratio — `object-cover` crops it hard. Pixels now.
    2. The box follows the cursor and is centred on it, so on the first rows
       it ran off the top of the window (measured at y = -47 on a 900px
       viewport) and the cover was cut. `previewPlacement` clamps it half a
       box off each edge, and flips it to the cursor's left rather than
       overflowing right.
    Sizes: 520 / 620 / 720px tall by viewport tier, capped at 0.78vh and
    0.44vw. Roughly 35% bigger than before — it now covers the meta columns
    of the rows beside it, which is the accepted cost of the size.
  - **The Order board's drop caret is axis-aware** and this is the easy thing
    to get backwards: tiles flow left-to-right so the gap is vertical and the
    pointer's *horizontal* half decides the side; index rows stack, so both
    flip. Read the wrong axis and the caret marks a gap the drop won't use.
    Index is the mode actually worth reordering in — a gap between two rows
    is unambiguous where the side of a tile has to be inferred.
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
- **Settings tab** (`/admin/settings`, was the Music tab): the
  `youtubePlaylistId` field — see the player under P1 — plus the feed's
  default view and column count. See "Settings board" above.

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

0. **`npm run setup:contentful`** — one run, to create `defaultFeedView` and
   `defaultFeedColumns` on `siteSettings`. The Settings board writes them
   already; until the fields exist the feed just falls back to masonry/3.
   Idempotent, so re-running is safe.
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
