# Handoff — kaialan.com v2

Written for a session starting cold. Read `PLAN.md` for the full executable
plan and `CONTEXT.md` for why each decision was made; this file is the
current state and what to do next.

**Last updated:** 2026-08-23
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
- P1.8 — nav polish: profile-pic hover → about overlay (copy, links, quote).
- P1.9 — OG images (`opengraph-image.tsx`), richer metadata.
- P2 — deploy; replace fixtures with ~15 real projects.
- P3 — `/admin` studio: auth (password + TOTP + `iron-session`), asset
  panel, project form, drag-reorder, presigned R2 uploads,
  `scripts/encode.mjs`.
- P4 — bulk-import the remaining ~55 projects.

---

## Unverified

**Nobody has opened this in a browser.** Structure, data and status codes
are verified by asserting against served HTML; appearance and motion are
not. Specifically unconfirmed:

- The `layoutId` card → lightbox **morph**. Shared layout animation across
  a parallel-route boundary is exactly the thing that silently fails to
  match and degrades to a fade. **Check this first.**
- Hover-to-play smoothness, filter re-flow feel, spring tuning.

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

---

## Next session

1. `npm run dev`, open it, judge the morph and the motion.
2. Then either P1.8/P1.9 to close out P1, or chase the account setup that
   unblocks P2.

Before P3 lands auth: **flip the repo private** (plan decision #4).
