# Admin Studio (P3 v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A localhost-only `/admin` studio that can enter, edit, publish and order real portfolio projects in Contentful without touching Contentful's UI.

**Architecture:** One rule governs everything — **bytes go through a Route Handler, entities go through Server Actions.** Reads for the studio use a separate uncached preview client so drafts are visible; `lib/contentful.ts` (the public site's read path) is never modified. Pure logic lives in small `lib/admin/*` modules that are unit-tested; I/O and async Server Components are verified manually.

**Tech Stack:** Next.js 16.3.2 (App Router, Cache Components, Turbopack) · React 19.2.8 · TypeScript · Tailwind v4 · `contentful` (CDA) · `contentful-management` v12 (CMA, plain-client only) · `iron-session` · Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-studio-design.md`

## Global Constraints

- **No token may ever be `NEXT_PUBLIC_`.** Every CMA call happens in a Server Action or Route Handler.
- **`lib/contentful.ts` must not be modified.** The public read path stays byte-for-byte as it is.
- **Video fields round-trip untouched.** `videoMp4Url` and `videoWebmUrl` are deferred from the UI but must survive every save. Never drop them from an update payload.
- **`middleware.ts` is deprecated in Next 16** — the file is `proxy.ts` with a named export `proxy`.
- **Use `updateTag(tag)`, never bare `revalidateTag(tag)`** (deprecated without a profile). `updateTag` is Server-Action-only.
- **CMA is capped at 7 req/s.** Concurrency limit is 3 everywhere.
- **CMA is optimistically locked** on `sys.version`. Every update must send the version it read.
- **Contentful entity IDs, not slugs**, in `siteSettings.projectOrder`.
- **Publish bottom-up:** assets → shots → project. The CDA will not resolve links to unpublished records and `.withoutUnresolvableLinks` drops them silently.
- Tailwind v4, no config file — tokens live in `app/globals.css`.
- **No bold type.** Titles are regular or medium, never semibold/bold (global design law).

### Testing reality

Next's own Vitest guide states async Server Components are not supported by Vitest. So:

- **Unit-tested (TDD, Tasks 1–4):** all pure logic — publish-state derivation, slug handling, the concurrency pool and retry, order manipulation.
- **Manually verified (Tasks 5–13):** pages, actions, and the upload handler, each with an exact command or click-path and expected output. Task 14 runs the spec's full checklist.

Do not fake unit tests for async Server Components. A manual step with an exact expected output is more honest than a mock that asserts nothing.

## File Structure

**Created — pure logic (unit-tested):**
- `lib/admin/publish-state.ts` — derive `draft | live | live-edited` from `sys`
- `lib/admin/slug.ts` — slugify and validate
- `lib/admin/pool.ts` — concurrency-limited map, retry with backoff, rate-limit detection
- `lib/admin/order.ts` — reorder an array, project to an ID array

**Created — I/O (manually verified):**
- `lib/preview.ts` — uncached CDA client against `preview.contentful.com`
- `lib/cma.ts` — the only writer to Contentful
- `lib/session.ts` — iron-session config and helpers
- `proxy.ts` — gate `/admin/*`

**Created — routes and UI:**
- `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/login/page.tsx`
- `app/admin/projects/[id]/page.tsx`, `app/admin/order/page.tsx`
- `app/admin/actions.ts` — Server Actions, entities only
- `app/api/admin/upload/route.ts` — Route Handler, bytes only
- `components/admin/` — `project-form.tsx`, `shots-strip.tsx`, `drop-zone.tsx`, `order-list.tsx`, `status-pill.tsx`

**Modified:**
- `package.json` — `contentful-management` dev → prod; add `iron-session`, Vitest
- `.env.example` — three new names
- `app/robots.ts` — disallow `/admin`

---

### Task 1: Vitest setup + publish-state derivation

**Files:**
- Create: `vitest.config.mts`, `lib/admin/publish-state.ts`, `lib/admin/publish-state.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `type PublishState = 'draft' | 'live' | 'live-edited'`; `publishState(sys: EntrySys): PublishState`; `type EntrySys = { version: number; publishedVersion?: number }`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
})
```

- [ ] **Step 3: Add the test script to `package.json`**

Add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Create `lib/admin/publish-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { publishState } from './publish-state'

describe('publishState', () => {
  it('is draft when never published', () => {
    expect(publishState({ version: 3 })).toBe('draft')
  })

  it('is draft after unpublishing (publishedVersion is cleared)', () => {
    expect(publishState({ version: 9, publishedVersion: undefined })).toBe('draft')
  })

  it('is live immediately after publish, when version is publishedVersion + 1', () => {
    expect(publishState({ version: 5, publishedVersion: 4 })).toBe('live')
  })

  it('is live-edited once a draft has been saved on top of a published entry', () => {
    expect(publishState({ version: 6, publishedVersion: 4 })).toBe('live-edited')
  })

  it('treats a large edit gap as live-edited', () => {
    expect(publishState({ version: 20, publishedVersion: 4 })).toBe('live-edited')
  })
})
```

Why `version === publishedVersion + 1` means unmodified: publishing is itself a write, so Contentful bumps `version` to one past the version it recorded as published. Any further edit pushes it higher.

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- publish-state`
Expected: FAIL — `Failed to resolve import "./publish-state"`

- [ ] **Step 6: Write the implementation**

Create `lib/admin/publish-state.ts`:

```ts
/** The three states a Contentful entry can present in the studio.
 *
 *  Contentful keeps a draft and a published version of the same entry, so
 *  "live" and "has unpublished edits" are different things and the studio
 *  must show both — otherwise saving a draft on a live project looks like
 *  it did nothing.
 */
export type PublishState = 'draft' | 'live' | 'live-edited'

export type EntrySys = {
  version: number
  publishedVersion?: number
}

export function publishState(sys: EntrySys): PublishState {
  if (sys.publishedVersion === undefined) return 'draft'
  // Publishing bumps `version` one past `publishedVersion`, so equality with
  // publishedVersion + 1 means "nothing changed since publish".
  return sys.version > sys.publishedVersion + 1 ? 'live-edited' : 'live'
}

export const PUBLISH_STATE_LABEL: Record<PublishState, string> = {
  draft: 'Draft',
  live: 'Live',
  'live-edited': 'Live · edited',
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- publish-state`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.mts package.json package-lock.json lib/admin/publish-state.ts lib/admin/publish-state.test.ts
git commit -m "test: add vitest; derive publish state from Contentful sys"
```

---

### Task 2: Slug handling

**Files:**
- Create: `lib/admin/slug.ts`, `lib/admin/slug.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `slugify(input: string): string`; `isValidSlug(slug: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isValidSlug, slugify } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Grain Weave')).toBe('grain-weave')
  })

  it('strips punctuation', () => {
    expect(slugify('Kaialan.com — v2!')).toBe('kaialan-com-v2')
  })

  it('collapses runs of separators', () => {
    expect(slugify('a   b---c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello')
  })

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café Noir')).toBe('cafe-noir')
  })

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('isValidSlug', () => {
  it('accepts a normal slug', () => {
    expect(isValidSlug('grain-weave')).toBe(true)
  })

  it('rejects empty', () => {
    expect(isValidSlug('')).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidSlug('Grain')).toBe(false)
  })

  it('rejects spaces and leading or trailing hyphens', () => {
    expect(isValidSlug('grain weave')).toBe(false)
    expect(isValidSlug('-grain')).toBe(false)
    expect(isValidSlug('grain-')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- slug`
Expected: FAIL — cannot resolve `./slug`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/slug.ts`:

```ts
/** Slugs are set at creation and warned about on edit — changing one breaks
 *  every link already shared, so the rules here are deliberately strict. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks so "Café" becomes "Cafe", not "Caf".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- slug`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/slug.ts lib/admin/slug.test.ts
git commit -m "feat: slug generation and validation for the studio"
```

---

### Task 3: Concurrency pool and retry

This is what keeps the bulk drop inside Contentful's 7 req/s cap and lets a partly-failed drop keep its successes.

**Files:**
- Create: `lib/admin/pool.ts`, `lib/admin/pool.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]>`
  - `retry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T>`
  - `type RetryOptions = { attempts?: number; baseMs?: number; shouldRetry?: (error: unknown) => boolean; sleep?: (ms: number) => Promise<void> }`
  - `isRateLimited(error: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/pool.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { isRateLimited, mapWithLimit, retry } from './pool'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('mapWithLimit', () => {
  it('never runs more than `limit` at once', async () => {
    let running = 0
    let peak = 0
    const fn = async () => {
      running++
      peak = Math.max(peak, running)
      await tick()
      running--
      return null
    }
    await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 3, fn)
    expect(peak).toBe(3)
  })

  it('returns results in input order', async () => {
    const items = [30, 10, 20]
    const out = await mapWithLimit(items, 2, async (n) => {
      await new Promise((r) => setTimeout(r, n))
      return n
    })
    expect(out.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([30, 10, 20])
  })

  it('keeps successes when one item rejects', async () => {
    const out = await mapWithLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    })
    expect(out[0]).toMatchObject({ status: 'fulfilled', value: 1 })
    expect(out[1].status).toBe('rejected')
    expect(out[2]).toMatchObject({ status: 'fulfilled', value: 3 })
  })

  it('handles an empty list', async () => {
    expect(await mapWithLimit([], 3, async () => 1)).toEqual([])
  })
})

describe('retry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok')
    expect(await retry(fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries then succeeds', async () => {
    let calls = 0
    const fn = async () => {
      calls++
      if (calls < 3) throw new Error('429')
      return 'ok'
    }
    const result = await retry(fn, { attempts: 3, sleep: async () => {} })
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('throws the last error once attempts are exhausted', async () => {
    const fn = async () => {
      throw new Error('always')
    }
    await expect(retry(fn, { attempts: 2, sleep: async () => {} })).rejects.toThrow('always')
  })

  it('does not retry when shouldRetry says no', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal')
    })
    await expect(
      retry(fn, { attempts: 5, sleep: async () => {}, shouldRetry: () => false }),
    ).rejects.toThrow('fatal')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('backs off exponentially', async () => {
    const waits: number[] = []
    let calls = 0
    const fn = async () => {
      calls++
      if (calls < 4) throw new Error('429')
      return 'ok'
    }
    await retry(fn, {
      attempts: 4,
      baseMs: 100,
      sleep: async (ms) => {
        waits.push(ms)
      },
    })
    expect(waits).toEqual([100, 200, 400])
  })
})

describe('isRateLimited', () => {
  it('detects a Contentful 429 by status', () => {
    expect(isRateLimited({ status: 429 })).toBe(true)
  })

  it('detects a 429 reported on the response', () => {
    expect(isRateLimited({ response: { status: 429 } })).toBe(true)
  })

  it('detects Contentful RateLimitExceeded by name', () => {
    expect(isRateLimited({ name: 'RateLimitExceeded' })).toBe(true)
  })

  it('is false for other errors and non-objects', () => {
    expect(isRateLimited({ status: 500 })).toBe(false)
    expect(isRateLimited(null)).toBe(false)
    expect(isRateLimited('429')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- pool`
Expected: FAIL — cannot resolve `./pool`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/pool.ts`:

```ts
/** Contentful's CMA allows 7 req/s. Every batch the studio sends goes through
 *  here so a bulk drop cannot trip the limit, and so one bad file never
 *  discards the files that uploaded cleanly. */

export type RetryOptions = {
  attempts?: number
  baseMs?: number
  shouldRetry?: (error: unknown) => boolean
  /** Injectable so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Runs `fn` over `items` with at most `limit` in flight.
 *  Settled results, in input order — callers decide what a failure means. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let next = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: size }, worker))
  return results
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseMs = 500, shouldRetry = () => true, sleep = defaultSleep } = opts

  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts - 1 || !shouldRetry(error)) break
      await sleep(baseMs * 2 ** attempt)
    }
  }
  throw lastError
}

/** Contentful reports rate limiting inconsistently depending on the layer that
 *  surfaces it, so check every shape rather than trusting one. */
export function isRateLimited(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { status?: unknown; name?: unknown; response?: { status?: unknown } }
  return e.status === 429 || e.response?.status === 429 || e.name === 'RateLimitExceeded'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- pool`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/pool.ts lib/admin/pool.test.ts
git commit -m "feat: concurrency pool and backoff retry for CMA calls"
```

---

### Task 4: Order manipulation

**Files:**
- Create: `lib/admin/order.ts`, `lib/admin/order.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `moveItem<T>(items: T[], from: number, to: number): T[]`; `toIdArray<T extends { id: string }>(items: T[]): string[]`

- [ ] **Step 1: Write the failing test**

Create `lib/admin/order.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { moveItem, toIdArray } from './order'

describe('moveItem', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op when the indices match', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    moveItem(input, 0, 2)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('returns a copy unchanged when an index is out of range', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('toIdArray', () => {
  it('projects entity ids in order', () => {
    expect(toIdArray([{ id: 'x' }, { id: 'y' }])).toEqual(['x', 'y'])
  })

  it('handles an empty list', () => {
    expect(toIdArray([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- order`
Expected: FAIL — cannot resolve `./order`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/order.ts`:

```ts
/** Reordering writes ONE array of entity IDs to siteSettings — never a
 *  per-entry order field, which would be 80 writes instead of 1.
 *  IDs, not slugs: a slug rename must not silently drop a project to the end. */

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function toIdArray<T extends { id: string }>(items: T[]): string[] {
  return items.map((item) => item.id)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- order`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/order.ts lib/admin/order.test.ts
git commit -m "feat: order manipulation helpers for the studio"
```

---

### Task 5: Session, auth gate and robots

**Files:**
- Create: `lib/session.ts`, `proxy.ts`, `app/admin/login/page.tsx`, `app/admin/login/actions.ts`
- Modify: `package.json`, `.env.example`, `app/robots.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `getSession(): Promise<AdminSession>`; `type AdminSession = IronSession<{ isLoggedIn?: boolean }>`; `login(prevState, formData): Promise<{ error?: string }>`; `logout(): Promise<void>`

- [ ] **Step 1: Install `iron-session` and promote `contentful-management`**

```bash
npm install iron-session
npm install contentful-management@^12.15.0
npm uninstall --save-dev contentful-management
```

Verify `contentful-management` now sits under `"dependencies"` in `package.json`, not `"devDependencies"` — the studio needs it at runtime, whereas today only the setup/seed scripts use it.

- [ ] **Step 2: Add the new names to `.env.example`**

Append (names only, never values — the file is committed):

```
# ---- Studio (/admin) ----
# Same Contentful API key as delivery; use its Preview token.
CONTENTFUL_PREVIEW_TOKEN=
# Studio login. Local only for now.
ADMIN_PASSWORD=
# iron-session cookie encryption, >= 32 characters.
SESSION_SECRET=
```

Then set real values in `.env.local` (which is gitignored). Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 3: Create `lib/session.ts`**

```ts
import 'server-only'
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export type AdminSession = IronSession<{ isLoggedIn?: boolean }>

export const SESSION_COOKIE = 'kaialan_studio'

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters.')
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      // Localhost is plain HTTP; forcing Secure here would silently drop the cookie.
      secure: process.env.NODE_ENV === 'production',
    },
  }
}

export async function getSession(): Promise<AdminSession> {
  return getIronSession(await cookies(), sessionOptions())
}
```

- [ ] **Step 4: Create `proxy.ts` at the repo root**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

/** Next 16 renamed `middleware` to `proxy`; the named export must be `proxy`.
 *
 *  This only checks that a session cookie EXISTS — it does not decrypt it.
 *  Proxy runs on every matched request and iron-session's crypto is not worth
 *  paying there; the pages themselves verify the session properly.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE)
  const isLogin = request.nextUrl.pathname === '/admin/login'

  if (!hasSession && !isLogin) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 5: Create `app/admin/login/actions.ts`**

```ts
'use server'

import { timingSafeEqual } from 'node:crypto'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export type LoginState = { error?: string }

/** Constant-time compare that does not leak length through an early return. */
function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    // Still burn a comparison so timing does not distinguish wrong-length.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return { error: 'ADMIN_PASSWORD is not set on the server.' }

  const password = String(formData.get('password') ?? '')
  if (!passwordMatches(password, expected)) return { error: 'Wrong password.' }

  const session = await getSession()
  session.isLoggedIn = true
  await session.save()
  redirect('/admin')
}

export async function logout() {
  const session = await getSession()
  session.destroy()
  redirect('/admin/login')
}
```

- [ ] **Step 6: Create `app/admin/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'

const initial: LoginState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <form action={formAction} className="flex w-full max-w-xs flex-col gap-3">
        <h1 className="type-body font-medium tracking-tight text-ink">Studio</h1>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          className="rounded-lg border border-card-edge bg-canvas px-3 py-2 text-ink"
        />
        <button
          type="submit"
          disabled={pending}
          className="type-button rounded-pill bg-surface-warm px-3 py-2 text-ink disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
        {state.error && <p className="type-meta text-muted">{state.error}</p>}
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Disallow `/admin` in `app/robots.ts`**

Open `app/robots.ts` and add `disallow: '/admin'` to the existing rules object (keep whatever `allow` is already there).

- [ ] **Step 8: Verify manually**

```bash
npm run dev
```

Then, in another shell:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/admin
curl -s http://localhost:3000/robots.txt | grep -i disallow
```

Expected: `307 http://localhost:3000/admin/login`, and a `Disallow: /admin` line.

In the browser, open `http://localhost:3000/admin`, confirm the redirect to the login form, enter the wrong password (expect "Wrong password."), then the right one (expect a redirect to `/admin`, which will 404 until Task 7 — that is correct at this point).

- [ ] **Step 9: Commit**

```bash
git add lib/session.ts proxy.ts app/admin/login app/robots.ts package.json package-lock.json .env.example
git commit -m "feat: password gate for the studio behind proxy.ts"
```

---

### Task 6: Preview reads and the CMA writer

**Files:**
- Create: `lib/preview.ts`, `lib/cma.ts`

**Interfaces:**
- Consumes: `publishState`, `EntrySys` (Task 1)
- Produces:
  - `lib/preview.ts`: `type AdminProject = { id: string; title: string; slug: string; category: string; state: PublishState; coverUrl?: string; updatedAt: string }`; `listProjects(): Promise<AdminProject[]>`; `getRawProject(id: string): Promise<RawEntry | null>`
  - `lib/cma.ts`: `cmaEnv(): CmaEnv` returning `{ client, spaceId, environmentId }`; `createEntry(contentType, fields)`; `updateEntry(entryId, changed, expectedVersion?)` — **merges** `changed` into the entry's CMA fields, throws `VersionConflictError`; `publishEntry(entryId)`; `unpublishEntry(entryId)`; `toEntryLink(idOrResolvedEntity)`; `localize(fields)`; `LOCALE`

- [ ] **Step 1: Create `lib/preview.ts`**

```ts
/** Studio reads. Separate from lib/contentful.ts on purpose:
 *   - preview host, so DRAFTS are visible
 *   - uncached, because editing against stale data is editing against a lie
 *  lib/contentful.ts is never modified; the public site keeps its own path.
 */
import 'server-only'
import { createClient } from 'contentful'
import { publishState, type PublishState } from './admin/publish-state'

export type RawEntry = {
  sys: { id: string; version: number; publishedVersion?: number; updatedAt: string }
  fields: Record<string, unknown>
}

export type AdminProject = {
  id: string
  title: string
  slug: string
  category: string
  state: PublishState
  coverUrl?: string
  updatedAt: string
}

function previewClient() {
  const space = process.env.CONTENTFUL_SPACE_ID
  const accessToken = process.env.CONTENTFUL_PREVIEW_TOKEN
  if (!space || !accessToken) {
    throw new Error('Missing CONTENTFUL_SPACE_ID / CONTENTFUL_PREVIEW_TOKEN.')
  }
  return createClient({
    space,
    accessToken,
    host: 'preview.contentful.com',
    environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  }).withoutUnresolvableLinks
}

function coverUrlOf(fields: Record<string, unknown>): string | undefined {
  const cover = fields.coverShot as { fields?: { image?: { fields?: { file?: { url?: string } } } } } | undefined
  return cover?.fields?.image?.fields?.file?.url
}

export async function listProjects(): Promise<AdminProject[]> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    include: 2,
    order: ['-sys.updatedAt'],
    limit: 1000,
  })

  return res.items.map((item) => {
    const e = item as unknown as RawEntry
    return {
      id: e.sys.id,
      title: (e.fields.title as string) ?? '(untitled)',
      slug: (e.fields.slug as string) ?? '',
      category: (e.fields.category as string) ?? '',
      state: publishState(e.sys),
      coverUrl: coverUrlOf(e.fields),
      updatedAt: e.sys.updatedAt,
    }
  })
}

export async function getRawProject(id: string): Promise<RawEntry | null> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    'sys.id': id,
    include: 2,
    limit: 1,
  })
  return (res.items[0] as unknown as RawEntry) ?? null
}
```

- [ ] **Step 2: Create `lib/cma.ts`**

`contentful-management` v12 is **plain-client only** — `createClient(...).getSpace()` no longer exists, so everything goes through `createClient({ accessToken }, { type: 'plain' })`.

```ts
/** The ONLY module that writes to Contentful. Never imported by a Client
 *  Component; every caller is a Server Action or Route Handler. */
import 'server-only'
import { createClient, type PlainClientAPI } from 'contentful-management'

export type CmaEnv = {
  client: PlainClientAPI
  spaceId: string
  environmentId: string
}

export function cmaEnv(): CmaEnv {
  const accessToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN
  const spaceId = process.env.CONTENTFUL_SPACE_ID
  if (!accessToken || !spaceId) {
    throw new Error('Missing CONTENTFUL_MANAGEMENT_TOKEN / CONTENTFUL_SPACE_ID.')
  }
  // v12 is plain-client only.
  const client = createClient({ accessToken }, { type: 'plain' })
  return {
    client,
    spaceId,
    environmentId: process.env.CONTENTFUL_ENVIRONMENT || 'master',
  }
}

/** Contentful stores every field per-locale. The site is single-locale, so
 *  wrap in exactly one place. (Reads go through lib/preview.ts, which uses the
 *  CDA and hands back already-flattened fields, so there is no unwrap here.) */
export const LOCALE = 'en-US'

export function localize(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, { [LOCALE]: value }]),
  )
}

/** Thrown when the entry moved on since the version the form was built from. */
export class VersionConflictError extends Error {
  constructor() {
    super('This entry changed elsewhere.')
    this.name = 'VersionConflictError'
  }
}

export async function createEntry(contentType: string, fields: Record<string, unknown>) {
  const { client, spaceId, environmentId } = cmaEnv()
  return client.entry.create(
    { spaceId, environmentId, contentTypeId: contentType },
    { fields: localize(fields) },
  )
}

/** Re-reads the entry so the CMA gets back exactly the shape it handed out —
 *  the plain client's `update` wants the whole entry, not a synthesised `sys`.
 *
 *  MERGES `changed` into the entry's existing fields. Callers pass ONLY what
 *  they are changing.
 *
 *  This is load-bearing, not a convenience. Reads come from lib/preview.ts via
 *  the CDA with `include: 2`, which resolves `shots` and `coverShot` into FULL
 *  ENTRY OBJECTS. Spreading those back into a CMA update would replace every
 *  link with an inlined entity and corrupt the references on the first save,
 *  silently. Merging server-side means untouched fields — including the
 *  deferred `videoMp4Url` / `videoWebmUrl` — are preserved structurally rather
 *  than by every caller remembering to re-send them.
 *
 *  Pass `expectedVersion` (the version the edit was based on) for optimistic
 *  locking: a mismatch means someone else wrote in the meantime. */
export async function updateEntry(
  entryId: string,
  changed: Record<string, unknown>,
  expectedVersion?: number,
) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })

  if (expectedVersion !== undefined && current.sys.version !== expectedVersion) {
    throw new VersionConflictError()
  }

  current.fields = { ...current.fields, ...localize(changed) } as typeof current.fields
  return client.entry.update({ spaceId, environmentId, entryId }, current)
}

/** CDA-resolved entities carry `sys.id`, so this narrows a resolved entry (or
 *  an id) back to the link shape the CMA requires. */
export function toEntryLink(value: string | { sys?: { id?: string } }) {
  const id = typeof value === 'string' ? value : value?.sys?.id
  if (!id) throw new Error('Cannot build an entry link without an id.')
  return { sys: { type: 'Link', linkType: 'Entry', id } }
}

export async function publishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  const current = await client.entry.get({ spaceId, environmentId, entryId })
  return client.entry.publish({ spaceId, environmentId, entryId }, current)
}

export async function unpublishEntry(entryId: string) {
  const { client, spaceId, environmentId } = cmaEnv()
  return client.entry.unpublish({ spaceId, environmentId, entryId })
}
```

- [ ] **Step 3: Get a Preview token and set it**

In Contentful: Settings → API keys → open the same key already used for delivery → copy the **Content Preview API - access token**. Put it in `.env.local` as `CONTENTFUL_PREVIEW_TOKEN`.

- [ ] **Step 4: Verify the preview client sees drafts**

Create a scratch file `scratch-preview.mjs` at the repo root:

```js
import { createClient } from 'contentful'

const client = createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
  host: 'preview.contentful.com',
  environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
})

const res = await client.getEntries({ content_type: 'project', limit: 1000 })
console.log('projects visible to preview:', res.items.length)
```

Run:

```bash
node --env-file-if-exists=.env.local scratch-preview.mjs
```

Expected: a count ≥ the number of published projects (30 with the fixtures seeded). If it errors with 401, the token is the delivery token, not the preview one.

Then delete the scratch file:

```bash
rm scratch-preview.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/preview.ts lib/cma.ts
git commit -m "feat: preview reads and CMA write helpers for the studio"
```

---

### Task 7: Studio shell and project list

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`, `components/admin/status-pill.tsx`

**Interfaces:**
- Consumes: `listProjects`, `AdminProject` (Task 6); `PUBLISH_STATE_LABEL`, `PublishState` (Task 1); `logout` (Task 5)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Create `components/admin/status-pill.tsx`**

```tsx
import { PUBLISH_STATE_LABEL, type PublishState } from '@/lib/admin/publish-state'

const TONE: Record<PublishState, string> = {
  draft: 'bg-surface-warm text-muted',
  live: 'bg-surface-warm text-ink',
  'live-edited': 'bg-surface-warm text-ink',
}

const StatusPill = ({ state }: { state: PublishState }) => (
  <span className={`type-meta rounded-pill px-2 py-0.5 ${TONE[state]}`}>
    {state === 'live-edited' && <span aria-hidden className="mr-1">•</span>}
    {PUBLISH_STATE_LABEL[state]}
  </span>
)

export default StatusPill
```

- [ ] **Step 2: Create `app/admin/layout.tsx`**

```tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { logout } from './login/actions'

export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="flex w-48 shrink-0 flex-col gap-1 border-r border-hairline p-4">
        <span className="type-meta text-muted-soft">Studio</span>
        <Link href="/admin" className="type-body text-ink">Projects</Link>
        <Link href="/admin/order" className="type-body text-ink">Order</Link>
        <form action={logout} className="mt-auto">
          <button type="submit" className="type-meta text-muted">Log out</button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

Note: `/admin/login` renders its own full-page `<main>` and sits inside this layout. That is acceptable — the proxy never lets an unauthenticated user reach any other `/admin` route, and a logged-out user is redirected away from `/admin/login` anyway.

- [ ] **Step 3: Create `app/admin/page.tsx`**

```tsx
import Link from 'next/link'
import { listProjects } from '@/lib/preview'
import StatusPill from '@/components/admin/status-pill'

export default async function AdminProjectsPage() {
  const projects = await listProjects()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="type-body font-medium tracking-tight text-ink">
          Projects <span className="text-muted-soft">{projects.length}</span>
        </h1>
        <Link
          href="/admin/projects/new"
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink"
        >
          New project
        </Link>
      </header>

      <ul className="flex flex-col">
        {projects.map((project) => (
          <li key={project.id} className="border-b border-hairline">
            <Link
              href={`/admin/projects/${project.id}`}
              className="flex items-center gap-4 py-3"
            >
              {project.coverUrl ? (
                <img
                  src={`${project.coverUrl}?w=80&h=56&fit=fill&fm=webp`}
                  alt=""
                  width={40}
                  height={28}
                  className="h-7 w-10 rounded object-cover"
                />
              ) : (
                <span className="h-7 w-10 rounded bg-surface-warm" />
              )}
              <span className="type-body flex-1 text-ink">{project.title}</span>
              <span className="type-meta text-muted">{project.category}</span>
              <StatusPill state={project.state} />
            </Link>
          </li>
        ))}
      </ul>

      {projects.length === 0 && (
        <p className="type-body text-muted">Nothing here yet.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify manually**

With `npm run dev` running, log in and open `http://localhost:3000/admin`.

Expected: a list of the 30 seeded `test-` projects, each with a cover thumbnail and a **Live** pill (the fixtures were seeded published).

Then prove the third state is real. In Contentful's web app, open any project, change its title, and click **Save** (not Publish). Reload `/admin`.

Expected: that project now shows **Live · edited**, and it is the first row (the list is ordered by `sys.updatedAt`).

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx components/admin/status-pill.tsx
git commit -m "feat: studio shell and project list with draft-aware status"
```

---

### Task 8: Project form — load and save draft

**Files:**
- Create: `components/admin/project-form.tsx`, `app/admin/projects/[id]/page.tsx`
- Modify: `lib/preview.ts` (add `slugExists`)
- Create: `app/admin/actions.ts`

**Interfaces:**
- Consumes: `getRawProject` (Task 6); `createEntry`, `updateEntry`, `VersionConflictError` (Task 6); `slugify`, `isValidSlug` (Task 2)
- Produces: `saveProject(prev: SaveState, formData: FormData): Promise<SaveState>`; `type SaveState = { error?: string; savedAt?: number; id?: string }`

- [ ] **Step 1: Add `slugExists` to `lib/preview.ts`**

```ts
/** A slug is the site's permanent URL for a project, so two projects must
 *  never share one. `exceptId` lets a project keep its own slug on edit. */
export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  const res = await previewClient().getEntries({
    content_type: 'project',
    'fields.slug': slug,
    limit: 2,
  })
  return res.items.some((item) => (item as unknown as RawEntry).sys.id !== exceptId)
}
```

Queried through the preview client on purpose: a draft already holding the slug
would be invisible to the delivery API, and you would only discover the clash
when publishing.

- [ ] **Step 2: Create `app/admin/actions.ts`**

```ts
'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createEntry, updateEntry, toEntryLink, VersionConflictError } from '@/lib/cma'
import { getRawProject, slugExists } from '@/lib/preview'
import { isValidSlug } from '@/lib/admin/slug'

export type SaveState = { error?: string; savedAt?: number; id?: string }

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']

function csv(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Saves a DRAFT. It never publishes — on an already-live project the site
 *  keeps serving the last published version until Publish is pressed. */
export async function saveProject(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const id = String(formData.get('id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim()

  if (!title) return { error: 'Title is required.' }
  if (!isValidSlug(slug)) return { error: 'Slug must be lowercase words joined by single hyphens.' }

  const yearRaw = String(formData.get('year') ?? '').trim()
  const category = String(formData.get('category') ?? '')
  if (!CATEGORIES.includes(category)) return { error: 'Pick a category.' }

  const fields: Record<string, unknown> = {
    title,
    slug,
    description: String(formData.get('description') ?? '').trim() || undefined,
    category,
    tags: csv(formData, 'tags'),
    year: yearRaw ? Number(yearRaw) : undefined,
    type: String(formData.get('type') ?? '').trim() || undefined,
    tools: csv(formData, 'tools'),
    client: String(formData.get('client') ?? '').trim() || undefined,
    featured: formData.get('featured') === 'on',
  }

  // Slugs are the site's permanent URLs, so a collision must be refused
  // rather than silently producing two projects that fight over one route.
  if (await slugExists(slug, id === 'new' ? undefined : id)) {
    return { error: `The slug "${slug}" is already used by another project.` }
  }

  if (!id || id === 'new') {
    const created = await createEntry('project', { ...fields, published: false })
    updateTag('projects')
    redirect(`/admin/projects/${created.sys.id}`)
  }

  const existing = await getRawProject(id)
  if (!existing) return { error: 'That project no longer exists.' }

  // No `preserved` spread: updateEntry MERGES into the entry's own CMA fields,
  // so `published`, `shots`, `coverShot`, `links` and the deferred video URLs
  // survive untouched. Spreading `existing.fields` here would be actively
  // WRONG — those come from the CDA with links already resolved into full
  // entities, and writing them back would corrupt every reference.
  try {
    await updateEntry(id, fields, existing.sys.version)
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return { error: 'This project changed elsewhere. Reload before saving.' }
    }
    throw error
  }

  updateTag('projects')
  return { savedAt: Date.now(), id }
}
```

Note what is **not** here: no re-sending of fields the form does not render. `updateEntry` merges into the entry's own CMA-side fields, so `shots`, `coverShot`, `published` and the deferred `videoMp4Url` / `videoWebmUrl` are preserved structurally. Re-sending them from `getRawProject` would corrupt them — the CDA resolves links into full entities, and the CMA needs links.

- [ ] **Step 3: Create `components/admin/project-form.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { saveProject, type SaveState } from '@/app/admin/actions'
import { slugify } from '@/lib/admin/slug'

export type ProjectFormValues = {
  id: string
  title: string
  slug: string
  description: string
  category: string
  tags: string
  year: string
  type: string
  tools: string
  client: string
  featured: boolean
}

const CATEGORIES = ['Product design', 'Graphics & Socials', 'Creatives', 'Framer']
const field = 'rounded-lg border border-card-edge bg-canvas px-3 py-2 text-ink type-body'
const initial: SaveState = {}

const ProjectForm = ({ values }: { values: ProjectFormValues }) => {
  const [state, formAction, pending] = useActionState(saveProject, initial)
  const isNew = values.id === 'new'

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="id" value={values.id} />

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Title</span>
        <input
          name="title"
          defaultValue={values.title}
          className={field}
          onBlur={(e) => {
            // Only auto-fill the slug while creating — never rewrite a live one.
            const form = e.currentTarget.form
            if (!isNew || !form) return
            const slugInput = form.elements.namedItem('slug') as HTMLInputElement | null
            if (slugInput && !slugInput.value) slugInput.value = slugify(e.currentTarget.value)
          }}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Slug</span>
        <input name="slug" defaultValue={values.slug} className={field} />
        {!isNew && (
          <span className="type-meta text-muted-soft">
            Changing this breaks every link you have already shared.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Description</span>
        <textarea name="description" defaultValue={values.description} rows={3} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Category</span>
        <select name="category" defaultValue={values.category || CATEGORIES[0]} className={field}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="type-meta text-muted">Year</span>
          <input name="year" type="number" defaultValue={values.year} className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="type-meta text-muted">Type</span>
          <input name="type" defaultValue={values.type} className={field} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Tags (comma separated)</span>
        <input name="tags" defaultValue={values.tags} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Tools (comma separated)</span>
        <input name="tools" defaultValue={values.tools} className={field} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="type-meta text-muted">Client</span>
        <input name="client" defaultValue={values.client} className={field} />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="featured" defaultChecked={values.featured} />
        <span className="type-body text-ink">Featured (autoplays in the grid)</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        {state.error && <span className="type-meta text-muted">{state.error}</span>}
        {state.savedAt && !state.error && <span className="type-meta text-muted">Saved.</span>}
      </div>
    </form>
  )
}

export default ProjectForm
```

- [ ] **Step 4: Create `app/admin/projects/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import ProjectForm, { type ProjectFormValues } from '@/components/admin/project-form'
import { getRawProject } from '@/lib/preview'

const EMPTY: ProjectFormValues = {
  id: 'new', title: '', slug: '', description: '', category: '',
  tags: '', year: '', type: '', tools: '', client: '', featured: false,
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const csv = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '')

export default async function ProjectEditPage({ params }: PageProps<'/admin/projects/[id]'>) {
  const { id } = await params

  if (id === 'new') {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="type-body font-medium tracking-tight text-ink">New project</h1>
        <ProjectForm values={EMPTY} />
      </div>
    )
  }

  const entry = await getRawProject(id)
  if (!entry) notFound()

  const values: ProjectFormValues = {
    id,
    title: str(entry.fields.title),
    slug: str(entry.fields.slug),
    description: str(entry.fields.description),
    category: str(entry.fields.category),
    tags: csv(entry.fields.tags),
    year: typeof entry.fields.year === 'number' ? String(entry.fields.year) : '',
    type: str(entry.fields.type),
    tools: csv(entry.fields.tools),
    client: str(entry.fields.client),
    featured: entry.fields.featured === true,
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-body font-medium tracking-tight text-ink">{values.title}</h1>
      <ProjectForm values={values} />
    </div>
  )
}
```

- [ ] **Step 5: Verify manually**

1. Open `/admin`, click any seeded project. Expect every field populated.
2. Change the title, press **Save draft**. Expect "Saved."
3. Reload `/admin`. Expect that project showing **Live · edited**.
4. Load the public site `http://localhost:3000/` and confirm the **old** title still shows — a draft must not reach the site.
5. Click **New project**, enter a title only, tab out, and confirm the slug auto-fills. Save with a bad slug like `Bad Slug` and expect the format error.
6. Give the new project the slug of an existing one (`test-grain-weave`, say) and save.
   Expected: `The slug "test-grain-weave" is already used by another project.`
7. Re-save an existing project without changing its slug.
   Expected: it saves cleanly — a project must not collide with itself.

- [ ] **Step 6: Verify video fields survived**

```bash
node --env-file-if-exists=.env.local -e "
const {createClient}=require('contentful');
createClient({space:process.env.CONTENTFUL_SPACE_ID,accessToken:process.env.CONTENTFUL_PREVIEW_TOKEN,host:'preview.contentful.com'})
.getEntries({content_type:'shot',limit:5}).then(r=>console.log(r.items.map(i=>({mp4:i.fields.videoMp4Url,w:i.fields.width}))))"
```

Expected: video URLs and dimensions unchanged on the shots of the project you just saved.

- [ ] **Step 7: Commit**

```bash
git add lib/preview.ts app/admin/actions.ts components/admin/project-form.tsx app/admin/projects
git commit -m "feat: project form with draft save and field preservation"
```

---

### Task 9: Publish and unpublish

**Files:**
- Modify: `app/admin/actions.ts`, `components/admin/project-form.tsx`

**Interfaces:**
- Consumes: `getRawProject` (Task 6); `publishEntry`, `unpublishEntry`, `updateEntry` (Task 6); `mapWithLimit`, `retry`, `isRateLimited` (Task 3)
- Produces: `publishProject(id: string): Promise<{ error?: string }>`; `unpublishProject(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: Add the publish walk to `app/admin/actions.ts`**

```ts
import { cmaEnv } from '@/lib/cma'
import { isRateLimited, mapWithLimit, retry } from '@/lib/admin/pool'

type Link = { sys: { id: string } }

const linkIds = (value: unknown): string[] =>
  Array.isArray(value) ? (value as Link[]).map((l) => l?.sys?.id).filter(Boolean) : []

/** Publishes bottom-up: assets, then shots, then the project.
 *
 *  Order is not cosmetic. The CDA resolves links only to PUBLISHED records and
 *  lib/contentful.ts uses `.withoutUnresolvableLinks`, so publishing a project
 *  whose shots are still drafts yields a project with its images silently
 *  missing — no error anywhere. */
export async function publishProject(id: string): Promise<{ error?: string }> {
  const { client, spaceId, environmentId } = cmaEnv()
  const entry = await getRawProject(id)
  if (!entry) return { error: 'That project no longer exists.' }

  const shotIds = [
    ...linkIds(entry.fields.shots),
    ...((entry.fields.coverShot as Link | undefined)?.sys?.id
      ? [(entry.fields.coverShot as Link).sys.id]
      : []),
  ]
  const uniqueShotIds = [...new Set(shotIds)]

  const withRetry = <T>(fn: () => Promise<T>) =>
    retry(fn, { attempts: 4, baseMs: 500, shouldRetry: isRateLimited })

  // 1. assets behind every shot
  const shots = await mapWithLimit(uniqueShotIds, 3, (shotId) =>
    withRetry(() => client.entry.get({ spaceId, environmentId, entryId: shotId })),
  )

  const assetIds = new Set<string>()
  for (const result of shots) {
    if (result.status !== 'fulfilled') continue
    const image = result.value.fields?.image?.['en-US'] as Link | undefined
    if (image?.sys?.id) assetIds.add(image.sys.id)
  }

  await mapWithLimit([...assetIds], 3, async (assetId) =>
    withRetry(async () => {
      const asset = await client.asset.get({ spaceId, environmentId, assetId })
      if (asset.sys.publishedVersion) return asset
      return client.asset.publish({ spaceId, environmentId, assetId, version: asset.sys.version }, asset)
    }),
  )

  // 2. the shot entries
  await mapWithLimit(uniqueShotIds, 3, async (shotId) =>
    withRetry(async () => {
      const shot = await client.entry.get({ spaceId, environmentId, entryId: shotId })
      return client.entry.publish({ spaceId, environmentId, entryId: shotId, version: shot.sys.version }, shot)
    }),
  )

  // 3. the project itself, with published: true
  const fresh = await getRawProject(id)
  if (!fresh) return { error: 'That project no longer exists.' }
  await updateEntry(id, { published: true }, fresh.sys.version)
  await publishEntry(id)

  updateTag('projects')
  return {}
}

export async function unpublishProject(id: string): Promise<{ error?: string }> {
  const entry = await getRawProject(id)
  if (!entry) return { error: 'That project no longer exists.' }

  // Flip the flag and publish that change, so the entry stays readable by the
  // CDA while `published: false` takes it off the site.
  await updateEntry(id, { published: false }, entry.sys.version)
  await publishEntry(id)

  updateTag('projects')
  return {}
}
```

- [ ] **Step 2: Add Publish / Unpublish buttons to the form**

In `components/admin/project-form.tsx`, add to the props: `state: PublishState` (import from `@/lib/admin/publish-state`), and render beside the Save button — only when `!isNew`:

```tsx
<button
  type="button"
  disabled={pending}
  onClick={() => startTransition(async () => { await publishProject(values.id) })}
  className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink"
>
  Publish
</button>
```

Import `publishProject` and `unpublishProject` from `@/app/admin/actions`, and `useTransition` from React for `startTransition`. Render **Unpublish** instead when `state !== 'draft'`. Pass `state={publishState(entry.sys)}` from `app/admin/projects/[id]/page.tsx`.

- [ ] **Step 3: Verify manually**

1. Open a seeded project, edit the title, **Save draft**, confirm the public site still shows the old title.
2. Press **Publish**. Reload `http://localhost:3000/`.
   Expected: the new title appears, and the project's images are all still there.
3. Press **Unpublish**. Reload `/`.
   Expected: the project disappears from the feed. `/admin` still lists it.
4. Re-publish it and confirm it returns with its shots intact.

Step 2's image check is the real assertion here — it is what proves the bottom-up ordering worked.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts components/admin/project-form.tsx app/admin/projects
git commit -m "feat: bottom-up publish and unpublish for projects"
```

---

### Task 10: Upload Route Handler

**Files:**
- Create: `app/api/admin/upload/route.ts`

**Interfaces:**
- Consumes: `cmaEnv` (Task 6); `retry`, `isRateLimited` (Task 3); `getSession` (Task 5)
- Produces: `POST /api/admin/upload` accepting `multipart/form-data` with one `file`, returning `{ assetId: string; url: string; width: number; height: number }` or `{ error: string }` with a non-200 status

- [ ] **Step 1: Create `app/api/admin/upload/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { cmaEnv, LOCALE } from '@/lib/cma'
import { isRateLimited, retry } from '@/lib/admin/pool'
import { getSession } from '@/lib/session'

/** Bytes go through here, never through a Server Action — actions cap request
 *  bodies at 1 MB by default, and Route Handlers stream. */

const PROCESS_TIMEOUT_MS = 15_000
const POLL_INTERVAL_MS = 500

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const { client, spaceId, environmentId } = cmaEnv()
  const withRetry = <T>(fn: () => Promise<T>) =>
    retry(fn, { attempts: 4, baseMs: 500, shouldRetry: isRateLimited })

  try {
    // Read the body ONCE, outside the retry wrapper: a retry must not re-read
    // an already-consumed stream, and `await` cannot appear in a non-async arrow.
    const buffer = await file.arrayBuffer()

    const upload = await withRetry(() =>
      client.upload.create({ spaceId, environmentId }, { file: buffer }),
    )

    let asset = await withRetry(() =>
      client.asset.create(
        { spaceId, environmentId },
        {
          fields: {
            title: { [LOCALE]: file.name.replace(/\.[^.]+$/, '') },
            file: {
              [LOCALE]: {
                contentType: file.type || 'application/octet-stream',
                fileName: file.name,
                uploadFrom: { sys: { type: 'Link', linkType: 'Upload', id: upload.sys.id } },
              },
            },
          },
        },
      ),
    )

    asset = await withRetry(() =>
      client.asset.processForAllLocales({ spaceId, environmentId }, asset, {}),
    )

    // Processing is asynchronous server-side. Without this poll the asset has
    // no file.url, the shot gets an empty imageUrl, and toShot() drops it
    // silently — a project whose images vanish with no error anywhere.
    const deadline = Date.now() + PROCESS_TIMEOUT_MS
    while (!asset.fields.file?.[LOCALE]?.url) {
      if (Date.now() > deadline) {
        return NextResponse.json(
          { error: `Contentful did not finish processing ${file.name} in time.` },
          { status: 504 },
        )
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      asset = await client.asset.get({ spaceId, environmentId, assetId: asset.sys.id })
    }

    await withRetry(() =>
      client.asset.publish({ spaceId, environmentId, assetId: asset.sys.id, version: asset.sys.version }, asset),
    )

    const details = asset.fields.file[LOCALE].details
    const image = details?.image
    if (!image?.width || !image?.height) {
      return NextResponse.json(
        { error: `${file.name} has no image dimensions — is it an image?` },
        { status: 422 },
      )
    }

    return NextResponse.json({
      assetId: asset.sys.id,
      url: asset.fields.file[LOCALE].url as string,
      width: image.width as number,
      height: image.height as number,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Note `await file.arrayBuffer()` inside the call: the CMA plain client accepts `string | ArrayBuffer | Stream`, and an `ArrayBuffer` is the least fussy of the three from a Web `File`.

- [ ] **Step 2: Verify with a real file**

With the dev server running and a browser session logged in, grab the cookie and post an image:

```bash
# Log in and keep the cookie
curl -s -c /tmp/studio.txt -X POST http://localhost:3000/admin/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "password=$ADMIN_PASSWORD" -o /dev/null

# Any real image on disk
curl -s -b /tmp/studio.txt -F "file=@public/pfp.jpg" \
  http://localhost:3000/api/admin/upload | tee /tmp/upload.json
```

Expected: JSON with `assetId`, an `//images.ctfassets.net/...` URL, and **non-zero `width` and `height`**. The dimensions are the whole point — they come free from Contentful after processing, so no browser-side extraction is needed for images.

Then confirm auth actually gates it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -F "file=@public/pfp.jpg" \
  http://localhost:3000/api/admin/upload
```

Expected: `401`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/upload/route.ts
git commit -m "feat: streaming upload handler with processing poll"
```

---

### Task 11: Bulk drop and addShots

**Files:**
- Create: `components/admin/drop-zone.tsx`
- Modify: `app/admin/actions.ts`, `app/admin/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: the upload route (Task 10); `createEntry`, `updateEntry`, `toEntryLink`, `getRawProject` (Tasks 6, 8)
- Produces: `addShots(projectId: string, assets: UploadedAsset[]): Promise<{ error?: string }>`; `type UploadedAsset = { assetId: string; width: number; height: number }`

- [ ] **Step 1: Add `addShots` to `app/admin/actions.ts`**

```ts
export type UploadedAsset = { assetId: string; width: number; height: number }

/** Creates one `shot` per uploaded asset and appends them to the project.
 *  If the project has no cover yet, the first shot becomes it — otherwise a
 *  freshly created project renders nothing, since toProject() drops any
 *  project without a coverShot. */
export async function addShots(
  projectId: string,
  assets: UploadedAsset[],
): Promise<{ error?: string }> {
  if (assets.length === 0) return {}

  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  const created = []
  for (const asset of assets) {
    const shot = await createEntry('shot', {
      kind: 'image',
      image: { sys: { type: 'Link', linkType: 'Asset', id: asset.assetId } },
      width: asset.width,
      height: asset.height,
    })
    created.push(toEntryLink(shot.sys.id))
  }

  // project.fields comes from the CDA with include: 2, so existing shots are
  // RESOLVED ENTITIES. Narrow them back to links before writing, or the update
  // inlines whole entries where references belong.
  const existingShots = Array.isArray(project.fields.shots)
    ? (project.fields.shots as { sys?: { id?: string } }[]).map(toEntryLink)
    : []

  const shots = [...existingShots, ...created]
  const existingCover = project.fields.coverShot as { sys?: { id?: string } } | undefined
  const coverShot = existingCover ? toEntryLink(existingCover) : created[0]

  await updateEntry(projectId, { shots, coverShot }, project.sys.version)

  updateTag('projects')
  return {}
}
```

Shots are created sequentially rather than through `mapWithLimit`: they are cheap metadata-only writes, and the uploads that precede them already consumed the rate-limit budget.

- [ ] **Step 2: Create `components/admin/drop-zone.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { addShots, type UploadedAsset } from '@/app/admin/actions'

type FileState = { name: string; status: 'pending' | 'done' | 'failed'; error?: string }

const CONCURRENCY = 3

const DropZone = ({ projectId }: { projectId: string }) => {
  const [files, setFiles] = useState<FileState[]>([])
  const [isPending, startTransition] = useTransition()

  const upload = async (list: File[]) => {
    setFiles(list.map((f) => ({ name: f.name, status: 'pending' })))
    const uploaded: UploadedAsset[] = []

    let cursor = 0
    const worker = async () => {
      while (cursor < list.length) {
        const index = cursor++
        const file = list[index]
        const body = new FormData()
        body.append('file', file)
        try {
          const res = await fetch('/api/admin/upload', { method: 'POST', body })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error ?? 'Upload failed')
          uploaded.push(json)
          setFiles((prev) =>
            prev.map((f, i) => (i === index ? { ...f, status: 'done' } : f)),
          )
        } catch (error) {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index
                ? { ...f, status: 'failed', error: (error as Error).message }
                : f,
            ),
          )
        }
      }
    }

    // Cap in-flight uploads: the CMA allows 7 req/s and each file is several calls.
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))

    // Successes are kept even when some files failed — never make the user
    // re-drop 18 good files because 2 broke.
    if (uploaded.length) {
      startTransition(async () => {
        await addShots(projectId, uploaded)
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/'),
          )
          if (dropped.length) void upload(dropped)
        }}
        className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-card-edge p-8"
      >
        <span className="type-body text-muted">Drop images here, or click to choose</span>
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? [])
            if (chosen.length) void upload(chosen)
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="type-meta flex gap-2 text-muted">
              <span className="flex-1 truncate">{f.name}</span>
              <span>
                {f.status === 'pending' && 'uploading…'}
                {f.status === 'done' && 'done'}
                {f.status === 'failed' && (f.error ?? 'failed')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isPending && <span className="type-meta text-muted">Attaching shots…</span>}
    </div>
  )
}

export default DropZone
```

- [ ] **Step 3: Render it on the project page**

In `app/admin/projects/[id]/page.tsx`, below `<ProjectForm />` and only when `id !== 'new'`:

```tsx
<DropZone projectId={id} />
```

Import it at the top. A project must exist before shots can attach to it, which is why `new` is excluded.

- [ ] **Step 4: Verify manually**

1. Open an existing project, drop **5 images** at once.
   Expected: each row goes `uploading… → done`, then "Attaching shots…", and no more than 3 upload at a time (watch the dev-server log).
2. Reload the page, press **Publish**, then load `/`.
   Expected: the new shots appear in that project's detail view at the right aspect ratios — proof the width/height round-tripped.
3. Drop a **non-image** (a `.txt` renamed to `.png`, say) alongside two good images.
   Expected: the bad one shows an error, the two good ones still say `done` and still become shots.

Test 3 is the important one — a partial failure must not discard the successes.

- [ ] **Step 5: Commit**

```bash
git add components/admin/drop-zone.tsx app/admin/actions.ts app/admin/projects
git commit -m "feat: bulk image drop with per-file status and partial-failure tolerance"
```

---

### Task 12: Shots strip — reorder and choose cover

**Files:**
- Create: `components/admin/shots-strip.tsx`
- Modify: `app/admin/actions.ts`, `app/admin/projects/[id]/page.tsx`, `lib/preview.ts`

**Interfaces:**
- Consumes: `moveItem`, `toIdArray` (Task 4); `getRawProject`, `updateEntry`, `toEntryLink` (Tasks 6, 8)
- Produces: `reorderShots(projectId: string, shotIds: string[]): Promise<{ error?: string }>`; `setCover(projectId: string, shotId: string): Promise<{ error?: string }>`; `getProjectShots(id: string): Promise<AdminShot[]>`; `type AdminShot = { id: string; url: string; width: number; height: number }`

- [ ] **Step 1: Add `getProjectShots` to `lib/preview.ts`**

```ts
export type AdminShot = { id: string; url: string; width: number; height: number }

export async function getProjectShots(id: string): Promise<AdminShot[]> {
  const entry = await getRawProject(id)
  if (!entry || !Array.isArray(entry.fields.shots)) return []

  return (entry.fields.shots as unknown[]).flatMap((raw) => {
    const shot = raw as {
      sys?: { id?: string }
      fields?: {
        width?: number
        height?: number
        image?: { fields?: { file?: { url?: string } } }
      }
    }
    const id = shot?.sys?.id
    const url = shot?.fields?.image?.fields?.file?.url
    const width = shot?.fields?.width
    const height = shot?.fields?.height
    return id && url && width && height ? [{ id, url, width, height }] : []
  })
}

export function coverShotId(entry: RawEntry): string | undefined {
  return (entry.fields.coverShot as { sys?: { id?: string } } | undefined)?.sys?.id
}
```

- [ ] **Step 2: Add the two actions to `app/admin/actions.ts`**

```ts
export async function reorderShots(
  projectId: string,
  shotIds: string[],
): Promise<{ error?: string }> {
  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  const shots = shotIds.map(toEntryLink)
  await updateEntry(projectId, { shots }, project.sys.version)

  updateTag('projects')
  return {}
}

export async function setCover(projectId: string, shotId: string): Promise<{ error?: string }> {
  const project = await getRawProject(projectId)
  if (!project) return { error: 'That project no longer exists.' }

  await updateEntry(projectId, { coverShot: toEntryLink(shotId) }, project.sys.version)

  updateTag('projects')
  return {}
}
```

`coverShot` is its own reference field, so choosing a cover never reorders `shots`.

- [ ] **Step 3: Create `components/admin/shots-strip.tsx`**

Uses the browser's native drag-and-drop — no library, matching the repo's zero-extra-deps habit.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { reorderShots, setCover } from '@/app/admin/actions'
import { moveItem, toIdArray } from '@/lib/admin/order'
import type { AdminShot } from '@/lib/preview'

const ShotsStrip = ({
  projectId,
  shots: initial,
  coverId,
}: {
  projectId: string
  shots: AdminShot[]
  coverId?: string
}) => {
  const [shots, setShots] = useState(initial)
  const [cover, setCoverState] = useState(coverId)
  const [dragging, setDragging] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  const drop = (to: number) => {
    if (dragging === null || dragging === to) return
    const next = moveItem(shots, dragging, to)
    setShots(next)
    setDragging(null)
    startTransition(async () => {
      await reorderShots(projectId, toIdArray(next))
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="type-meta text-muted">
        Shots — drag to reorder, click to set the cover
      </span>
      <ul className="flex flex-wrap gap-2">
        {shots.map((shot, index) => (
          <li
            key={shot.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(index)}
            className={`relative cursor-grab rounded border ${
              shot.id === cover ? 'border-ink' : 'border-card-edge'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setCoverState(shot.id)
                startTransition(async () => {
                  await setCover(projectId, shot.id)
                })
              }}
            >
              <img
                src={`${shot.url}?w=160&h=110&fit=fill&fm=webp`}
                alt=""
                width={80}
                height={55}
                className="h-14 w-20 rounded object-cover"
              />
            </button>
            {shot.id === cover && (
              <span className="type-meta absolute bottom-0 left-0 rounded bg-canvas px-1 text-ink">
                Cover
              </span>
            )}
          </li>
        ))}
      </ul>
      {shots.length === 0 && <span className="type-meta text-muted">No shots yet.</span>}
    </div>
  )
}

export default ShotsStrip
```

- [ ] **Step 4: Render it on the project page**

In `app/admin/projects/[id]/page.tsx`, for an existing project, fetch and pass the data:

```tsx
const shots = await getProjectShots(id)
// ...
<ShotsStrip projectId={id} shots={shots} coverId={coverShotId(entry)} />
```

Import `getProjectShots` and `coverShotId` from `@/lib/preview`.

- [ ] **Step 5: Verify manually**

1. Open a project with several shots. Drag the third to first. Reload — the new order persists.
2. Click a different shot. Expect the **Cover** badge to move.
3. Publish, reload `/`. Expect the card in the feed to show the new cover, and the detail view to show the new shot order.
4. Confirm choosing a cover did **not** reorder the shots.

- [ ] **Step 6: Commit**

```bash
git add components/admin/shots-strip.tsx lib/preview.ts app/admin/actions.ts app/admin/projects
git commit -m "feat: shot reordering and cover selection"
```

---

### Task 13: Order panel

**Files:**
- Create: `app/admin/order/page.tsx`, `components/admin/order-list.tsx`
- Modify: `app/admin/actions.ts`, `lib/preview.ts`

**Interfaces:**
- Consumes: `moveItem`, `toIdArray` (Task 4); `listProjects` (Task 6)
- Produces: `saveOrder(projectIds: string[]): Promise<{ error?: string }>`; `getSettingsEntry(): Promise<RawEntry | null>`

- [ ] **Step 1: Add `getSettingsEntry` to `lib/preview.ts`**

```ts
export async function getSettingsEntry(): Promise<RawEntry | null> {
  const res = await previewClient().getEntries({ content_type: 'siteSettings', limit: 1 })
  return (res.items[0] as unknown as RawEntry) ?? null
}
```

- [ ] **Step 2: Add `saveOrder` to `app/admin/actions.ts`**

```ts
import { getSettingsEntry } from '@/lib/preview'

/** ONE write to siteSettings, holding entry IDs. Never a per-entry order
 *  field — that would be 80 writes instead of 1 — and never slugs, because a
 *  slug rename would silently drop a project to the end. */
export async function saveOrder(projectIds: string[]): Promise<{ error?: string }> {
  const settings = await getSettingsEntry()
  if (!settings) return { error: 'No siteSettings entry exists. Run npm run setup:contentful.' }

  await updateEntry(settings.sys.id, { projectOrder: projectIds }, settings.sys.version)
  await publishEntry(settings.sys.id)

  // getProjects() is tagged with both, and a reorder must invalidate the feed.
  updateTag('settings')
  updateTag('projects')
  return {}
}
```

- [ ] **Step 3: Create `components/admin/order-list.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { saveOrder } from '@/app/admin/actions'
import { moveItem, toIdArray } from '@/lib/admin/order'
import type { AdminProject } from '@/lib/preview'

const OrderList = ({ projects }: { projects: AdminProject[] }) => {
  const [items, setItems] = useState(projects)
  const [dragging, setDragging] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const drop = (to: number) => {
    if (dragging === null || dragging === to) return
    setItems(moveItem(items, dragging, to))
    setDragging(null)
    setDirty(true)
    setSaved(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col">
        {items.map((project, index) => (
          <li
            key={project.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(index)}
            className="flex cursor-grab items-center gap-3 border-b border-hairline py-2"
          >
            <span className="type-meta w-6 text-muted-soft">{index + 1}</span>
            {project.coverUrl && (
              <img
                src={`${project.coverUrl}?w=80&h=56&fit=fill&fm=webp`}
                alt=""
                width={40}
                height={28}
                className="h-7 w-10 rounded object-cover"
              />
            )}
            <span className="type-body text-ink">{project.title}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || isPending}
          onClick={() =>
            startTransition(async () => {
              await saveOrder(toIdArray(items))
              setDirty(false)
              setSaved(true)
            })
          }
          className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save order'}
        </button>
        {saved && <span className="type-meta text-muted">Saved.</span>}
      </div>
    </div>
  )
}

export default OrderList
```

Explicit save, not autosave: reordering is a curation decision and should not fire a write per drag.

- [ ] **Step 4: Create `app/admin/order/page.tsx`**

```tsx
import OrderList from '@/components/admin/order-list'
import { listProjects } from '@/lib/preview'

export default async function OrderPage() {
  const projects = await listProjects()
  const live = projects.filter((p) => p.state !== 'draft')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-body font-medium tracking-tight text-ink">Order</h1>
        <p className="type-meta text-muted">
          Drag to arrange the feed. Drafts are not shown — they have no place in it yet.
        </p>
      </div>
      <OrderList projects={live} />
    </div>
  )
}
```

- [ ] **Step 5: Verify manually**

1. Open `/admin/order`. Drag the last project to the top. Note that **Save order** only enables once something moved.
2. Press **Save order**, then load `/`.
   Expected: that project is now first in the feed.
3. Reload `/admin/order` and confirm the order persisted.
4. Confirm exactly one entry was written:

```bash
node --env-file-if-exists=.env.local -e "
const {createClient}=require('contentful');
createClient({space:process.env.CONTENTFUL_SPACE_ID,accessToken:process.env.CONTENTFUL_PREVIEW_TOKEN,host:'preview.contentful.com'})
.getEntries({content_type:'siteSettings',limit:1}).then(r=>console.log(r.items[0].fields.projectOrder.slice(0,3)))"
```

Expected: an array of entry IDs whose first element is the project you moved to the top.

- [ ] **Step 6: Commit**

```bash
git add app/admin/order components/admin/order-list.tsx app/admin/actions.ts lib/preview.ts
git commit -m "feat: drag-reorder the feed with a single siteSettings write"
```

---

### Task 14: Full verification pass

**Files:** none created; this task runs the spec's checklist and fixes what it finds.

- [ ] **Step 1: Run the unit tests and the linter**

```bash
npm test
npm run lint
```

Expected: all tests pass; lint clean.

- [ ] **Step 2: Confirm no CMA token reaches the client bundle**

```bash
rm -rf .next && npm run build
grep -r "$(grep '^CONTENTFUL_MANAGEMENT_TOKEN=' .env.local | cut -d= -f2)" .next/static/ && echo "LEAKED" || echo "clean"
grep -rl "CONTENTFUL_MANAGEMENT_TOKEN\|ADMIN_PASSWORD\|SESSION_SECRET" .next/static/ && echo "LEAKED" || echo "clean"
```

Expected: `clean` twice. If the build fails with a prerender timeout, that is the known WSL2 networking flake — re-run it (see `docs/HANDOFF.md` → "WSL2 build networking").

- [ ] **Step 3: Walk the spec's verification list**

1. Create a project end-to-end (new → fields → drop images → publish); confirm it appears on `/` after one reload.
2. Bulk-drop 10 images → 10 shots, each with real dimensions, none missing from the rendered grid.
3. Reorder in `/admin/order`, save, confirm the feed order changed.
4. Save a draft → absent from `/`, present and editable in `/admin`.
5. Log out; hit `/admin/projects` directly → redirected to `/admin/login`.
6. Edit a project that has video URLs set, save, and confirm both fields round-trip unchanged.

- [ ] **Step 4: Update the handoff**

In `docs/HANDOFF.md`, move P3 items 1–3 and 5–7 from "Not done" into "Done", and record what remains deferred: R2, video, TOTP, the asset library, and shop CRUD. Note that the studio is localhost-only and must not be deployed until auth is hardened.

- [ ] **Step 5: Commit**

```bash
git add docs/HANDOFF.md
git commit -m "docs: record studio v1 as built, with deferrals"
```

---

## Deferred — explicitly not in this plan

Each has a stated reason in the spec; none is forgotten:

- **Cloudflare R2, presigned uploads, staging bucket** — no account yet. Requires re-introducing the plan's media pipeline before deploying.
- **Video** — schema fields stay and must round-trip; no UI writes them.
- **TOTP, recovery codes, login rate limiting** — required before this is ever reachable publicly.
- **Asset library, shop CRUD** — deliberately out of v1 scope.
- **`opengraph-image.tsx` / P1.9** — unrelated to the studio.
