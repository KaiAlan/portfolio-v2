# Handoff — kaialan.com v2

Written for a session starting cold. Read `PLAN.md` for the full executable
plan and `CONTEXT.md` for why each decision was made; this file is the
current state and what to do next.

**Last updated:** 2026-09-03
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
- 30 test projects / 88 shots seeded via `npm run seed`.

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

### P3 — The studio (v1, localhost-only)
Built against `docs/superpowers/plans/2026-09-03-admin-studio.md`, all 14
tasks complete. **Not deployed and not deployable as-is** — see the warning
below.

- **Auth**: password + `iron-session`, gate lives in `proxy.ts` and decrypts
  the cookie before the response streams (presence-only checking let a
  forged cookie through — see the comment there). Rate-limited login.
  **No TOTP / recovery codes** — deliberately deferred, and the reason it
  stays localhost-only.
- **Shell**: `app/admin/(studio)/` — sidebar with Projects / Order, dark UI.
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

**Verified for real, not by inspection** — a disposable `test-e2e-verify`
project was created, given 4 real uploaded images, published, and deleted;
an existing seeded project's video-bearing shot was confirmed to survive an
unrelated project-level edit untouched; the reorder write was confirmed
against Contentful directly and reverted. `npm run build` was also run once
clean (`rm -rf .next && npm run build`) and the client bundle grepped for
`CONTENTFUL_MANAGEMENT_TOKEN`, `ADMIN_PASSWORD` and `SESSION_SECRET` — none
present. **Still unverified: the actual browser UI** — upload progress,
drag-and-drop feel, the studio's dark theme. Nobody has opened `/admin` in a
browser yet, same caveat as the public site below.

**⚠ Do not deploy `/admin` yet.** Auth is a single password behind a
session cookie — sufficient for localhost, not for the public internet.
TOTP + recovery codes are required first (see Deferred, P3 plan). The repo
is also still **public** with this auth code now pushed to it; decision #4
in `PLAN.md` said to flip it private before auth landed, and that has not
happened.

**Deferred, with reasons, not gaps:** Cloudflare R2 / presigned uploads /
video flow (no card on file yet); TOTP + recovery codes + login rate
limiting beyond what exists (required before any public deploy); the asset
library (search, copy-URL, standalone delete — out of v1 scope); Shop CRUD
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

**Code remaining:**
- P1.9 — OG images (`opengraph-image.tsx`), richer metadata.
- P2 — deploy; replace fixtures with ~15 real projects.
- P3 hardening — TOTP + recovery codes, before `/admin` can ever be public.
  See "P3 — The studio" under Done for what already shipped.
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

1. `npm run dev`, open it, judge the morph and the motion for real — scripted
   Chromium confirms the mechanism works, not that it feels right. That's
   still eyes-only.
2. Flip the repo private (plan decision #4) — overdue now that P3 auth code
   is on GitHub, deliberately deferred to go-live rather than now. `gh repo
   edit KaiAlan/portfolio-v2 --visibility private
   --accept-visibility-change-consequences`.
3. Then either P1.9 (OG images) to close out P1, TOTP to make `/admin` safe
   to eventually deploy, or chase the account setup that unblocks P2.
