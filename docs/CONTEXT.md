# portfolio — session handoff

**Project name:** `portfolio` (kaialan.com v2)
**Planned:** 2026-08-21, via a full grilling session (mattpocock-skills:grilling), 22 questions across 3 rounds + a final fork round. Every branch closed.
**Status:** planning complete, **no code written yet**. Build starts 2026-08-22.

**Read `PLAN.md` in this directory first — it is the executable plan.** This file is the why behind it.

---

## What we're building

A cosmos.so / recent.design-style portfolio: one masonry feed of shots (images + short loop videos), a lightbox/detail view, and a separate Shop page of external-link cards. **No case studies — everything is shots.** A project is a wrapper around one or many shots.

Plus a private `/admin` studio (dark UI, designed in Figma by Kai) to upload assets, create projects, reorder the grid, and publish/unpublish — so the portfolio never has to be updated by editing code again.

Predecessor: `github.com/KaiAlan/portfolio-kaialan` (Next.js + Tailwind + Lottie, content hardcoded in `/data`). **Rebuilt from scratch**, not ported.

---

## The problem being solved

Kai stated two pains: "it's all code so it's hard to update" and "I have to manually copy each asset link out of Contentful."

Grilling established these are **one problem**: content lives in git instead of in a CMS. Making the site read Contentful kills the link-copying entirely, with zero tooling.

The studio is still being built, but for a **different, honest reason**: Kai dislikes Contentful's UI/UX and wants a minimal, premium tool personalised to this portfolio — not "every slop of option that there is to it." That's a valid reason. It is not the reason he originally gave, and the distinction is why the studio is **P3, after the portfolio is live**.

---

## Decisions locked (do not relitigate without new information)

| # | Decision | Why |
|---|---|---|
| 1 | Contentful Free for structured content + images | Images API gives free on-the-fly resize/format; already set up |
| 2 | Cloudflare R2 for video, at `cdn.kaialan.com` | $0 egress, uncapped — removes the only site-killing failure mode |
| 3 | One repo, one Next.js app, `/admin` route group | Kai first rejected this, then reversed once auth was specced |
| 4 | Repo **private** | No reason to publish the admin panel's auth surface |
| 5 | Vercel Hobby | Hard limits pause, never bill |
| 6 | Password + TOTP (`otplib`), `iron-session` | "Heavily secured"; real threat is credential reuse |
| 7 | Intercepting routes — lightbox + full page from one component | Shareable URLs *and* app-feel, no duplication |
| 8 | Light mode only, one typeface (+ optional mono) | Work is maximalist; frame shouldn't compete |
| 9 | Motion library — `layout` + `layoutId` | `layoutId` gives the card→lightbox morph |
| 10 | Custom masonry from stored `width`/`height` | CSS `columns` reads in wrong order and can't animate |
| 11 | Order in one `siteSettings` array, saved on click | Kai's idea, better than per-entry sparse ordering — 1 write vs 80 |
| 12 | Launch with ~15 projects, bulk-import ~55 at P3 | Ships weeks earlier; curated 15 > exhaustive 70 |
| 13 | Kai exports MP4 + WebM locally (`scripts/encode.mjs`) | Server-side ffmpeg impossible (see traps) |
| 14 | Bulk drop = many shots into the **open project** | Matches how he works |
| 15 | No search, no sort, no theme toggle in v1 | Curation is the point; each is a maintenance tax |

---

## Hard numbers (verified 2026-08-21 — re-check if much time passes)

**Contentful Free:** 1 Starter Space, 2 environments, 25 content types, 10k records, 100k API calls/mo, 50 MB max asset, CMA 7 req/s. **50 GB/mo asset bandwidth — a hard cap: delivery APIs (CDA/CPA/GraphQL) pause until the 1st of next month.** No overage billing. This is the only limit that can take the site offline.

**Cloudflare R2 free:** 10 GB storage, 1M Class A, 10M Class B ops/mo, **$0 egress, uncapped**. Requires a card on file to activate ($0 charged). `*.r2.dev` is rate-limited and "not intended for production" → **custom domain required**, which means DNS must be on Cloudflare.

**Vercel Hobby:** 100 GB fast data transfer, 5K image transformations, 300s max function duration, **4.5 MB max request body**. Never bills — pauses instead. **Non-commercial only**, and "advertising the sale of a product" is named explicitly (the Shop tab). Realistic consequence is an email, not a ban; hide Shop if it comes up.

**Bandwidth projection** at 2k visits/mo, 70 assets, images via Images API, video on R2: **~10 GB/mo Contentful = 20% of cap.** If video had stayed on Contentful with grid autoplay it would have been ~42 GB = 84%, i.e. one viral X post from a blackout.

**Domain:** `kaialan.com`, registered at **Porkbun**. Plan moves nameservers to Cloudflare (registration stays at Porkbun).

---

## Traps found during grilling (these would have bitten mid-build)

1. **Vercel caps request bodies at 4.5 MB on every plan.** Video loops and full-res images exceed it, so uploads can never pass through a Route Handler. → presigned direct-to-R2; for Contentful images, upload to an R2 staging prefix then hand the CMA the **external URL** (`file.upload`) so it pulls the bytes itself. Management token stays server-side.
2. **GIF is the *heavy* format, not the light one.** web.dev benchmark: 3.7 MB GIF → 551 KB MP4 / 341 KB WebM (85–91% smaller), plus GIF's 256-colour cap would band Kai's gradients. His instinct to keep a few loops always-moving was right; the format was backwards. → a `featured` boolean, muted `<video>`, studio warns past 5.
3. **`r2.dev` is rate-limited** and unsuitable for production → custom domain → DNS must move to Cloudflare. Also: set Vercel's DNS records to **DNS-only / grey cloud** — proxying Cloudflare in front of Vercel double-CDNs and causes cache bugs.
4. **Contentful's 50 GB is a hard cap, not an overage.** Failure mode is the whole site going blank, not a bill.

---

## Accounts / access needed before P0

- [ ] Contentful space + CDA token + CMA token
- [ ] Cloudflare account, R2 enabled (card on file), bucket created, usage alert set
- [ ] Porkbun → Cloudflare nameserver change
- [ ] Vercel project linked to the new private GitHub repo
- [ ] TOTP app on phone + recovery codes stored somewhere safe

---

## How to start tomorrow

1. `cd C:\home\claude-projects\portfolio`
2. Read `PLAN.md`.
3. Begin at **P0 — Foundations**. Do not skip step 6 (hand-enter 5 test projects with mixed image/video, mixed shot counts, one `featured`) — P1 needs real edge cases to render against.
4. Kai is designing the studio and site in Figma in parallel. **Focus on development; don't propose visual design unless asked.**

## Working notes for whoever picks this up

- Kai prefers **short answers** and being **actually correct** over hedged surveys. He asked to be grilled and responds well to firm pushback when it's backed by numbers — the GIF correction landed because it came with the web.dev benchmark attached.
- He reverses decisions when given a better argument (rejected `/admin` in-app, then accepted it once auth was specced). Present the trade-off, don't just comply.
- Verification matters to him. Each phase in `PLAN.md` has a Verify block — run them, don't assert.
