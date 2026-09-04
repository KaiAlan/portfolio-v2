# Motion — the rules for this site

**Read this before writing any animation, transition or easing.** It is the
motion equivalent of the token block in `app/globals.css`: colour, radius,
shadow and type were all tokenised with reasons, and motion was the one design
axis left ad-hoc until 2026-09-04.

The sourced research behind every number here is
`docs/superpowers/research/2026-09-04-motion-design.md` — 1,366 lines, every
claim cited, read against `node_modules/motion@13.1.1` rather than the docs
site. **This file is the law; that file is the why.** When they disagree, the
research is right and this file is stale.

---

## The three rules

1. **`transform` and `opacity` only.** They are the only properties the
   compositor can animate without a layout or paint pass. Anything else —
   `width`, `height`, `top`, `left`, `margin`, `filter` on a large surface — is a
   decision that has to justify itself against a 10ms frame budget.
2. **`bounce: 0` on anything that has to land somewhere specific.** Morphs, grid
   slots, a nav docking to the top. Overshoot means the element leaves the bounds
   it is animating into and comes back — which breaks the illusion that it *is*
   the destination. Bounce is only for things that merely have to arrive.
3. **Exits are shorter than entrances, and use a bezier not a spring.** Nobody
   reads an element that is leaving, and `AnimatePresence` needs a known end
   time. Ratio is 0.7×, anchored on Material 1's 225ms enter / 195ms leave.

---

## Tokens

### CSS — `app/globals.css`

Named for what they are *for*, not what they *are*: `--ease-exit` survives a
redesign, `--ease-cubic-4` does not.

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | on screen at both ends |
| `--ease-entrance` | `cubic-bezier(0, 0, 0.38, 0.9)` | arriving |
| `--ease-exit` | `cubic-bezier(0.2, 0, 1, 0.9)` | leaving |
| `--ease-overshoot` | `cubic-bezier(0.33, 1.53, 0.69, 0.99)` | one thing per screen, never text or morphs |

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | `70ms` | hover, focus, press |
| `--dur-fast` | `120ms` | small fades, icon swaps |
| `--dur-base` | `180ms` | the default — dropdowns, chips, tooltips |
| `--dur-slow` | `280ms` | panels, popovers |
| `--dur-page` | `420ms` | route change, lightbox chrome |
| `--dur-ambient` | `700ms` | backdrop, ambient colour |
| `--dur-*-out` | 0.7× the above | the exit half of each pair |

These come from **IBM Carbon's productive set**, not Material 3. M3's headline
`emphasized` curve is a two-segment SVG path
(`M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1`) and
**cannot be written as a CSS `cubic-bezier()` at all** — everyone circulating
`cubic-bezier(0.2, 0, 0, 1)` as "emphasized" is actually quoting `standard`.
Carbon's set is web-native, complete, and tuned for the dense work-focused case
this site is.

**Tailwind's defaults are overridden, not ignored.** `--default-transition-duration`
and `--default-transition-timing-function` are `@theme` tokens
(`node_modules/tailwindcss/theme.css:492`), shipping as `150ms` and
`cubic-bezier(0.4, 0, 0.2, 1)` — the latter being literally `ease-in-out`. Every
bare `transition-*` class in the app was therefore running ease-in-out, which
starts slow and makes a control feel like it lags the pointer. Overriding the two
tokens fixes every such class at once, the same way `cursor: pointer` was fixed
once in a base rule rather than on several dozen buttons.

So: **a bare `transition-colors` is now correct by default.** Only add an
explicit `duration-*`/`ease-*` when the element genuinely differs from the
baseline.

### JS — `lib/motion.ts`

`spring.morph`, `spring.sheet`, `spring.chrome`, `spring.toggle`,
`spring.release`, `spring.scroll`; `tween.exit`, `tween.fade`, `tween.backdrop`;
`gridStagger()`; `dampHalfLife()`. Read the file — every preset carries its
reasoning inline.

---

## Springs

**Use `visualDuration` + `bounce`, not `stiffness`/`damping`/`mass`** — with one
exception below. `bounce` maps exactly to the damping ratio as `ζ = 1 - bounce`
(`motion-dom.dev.js:806`), and `visualDuration` is the time to *first reach* the
target rather than to fully settle, which is the thing you can actually judge by
eye.

**The exception, and it is a trap:** a spring parameterised by
`duration`/`bounce`/`visualDuration` **forces `velocity = 0` when interrupted**
(`motion-dom.dev.js:889`). Only `stiffness`/`damping` springs inherit velocity.
This inverts the usual advice — the ergonomic parameterisation is the one that
throws away the thing springs exist for. **Anything gesture-driven or
interruptible (drag release) must use physics params.** That is why
`spring.release` looks different from its neighbours.

**Spring or bezier?** Spring for anything interruptible, gesture-driven, or
layout-based. Bezier for anything deterministic, choreographed, or exiting.

Note the shipped defaults differ from motion.dev's documentation (`stiffness`
ships as `100`, docs say `1`; `bounce` ships `0.3`, docs say `0.25`). The
bundled `.d.ts` is stale too. Trust the source.

---

## `layoutId` morphs — how not to break the card → lightbox

Motion measures the box before and after and animates the difference with
`translate` + `scale`. It never touches `width`/`height`, which is what makes it
cheap — but it means everything inside is being scaled, so it distorts.

- **Set `borderRadius` inline, via `style`.** Motion corrects the radius as a
  *percentage* to reduce paints (`motion-dom.dev.js:7477`), and **the correction
  only fires for `style` or animated values — never for a CSS class or a Tailwind
  `rounded-*` utility.** This is the single most common cause of a morph whose
  corners visibly squash, and it was live on both ends of this site's morph until
  2026-09-04. Same rule for `boxShadow`.
- **`layout="preserve-aspect"`** is the right default for a masonry feed: it
  animates size *and* position when the aspect ratio is continuous and degrades
  to position-only exactly when a full morph would have distorted. There are six
  values, not the three the docs list — `boolean | "position" | "size" |
  "preserve-aspect" | "x" | "y"`.
- **`layout="position"` for text.** Scaling a text node smears the glyphs, and if
  it reflows to a different line count between states the morph has no continuous
  interpretation at all.
- **Both ends must use the same transition.** Two different curves interpolated
  against each other visibly hitch. This includes a parent's `layout` versus its
  own child's `layoutId`.
- **`bounce: 0`.** See rule 2.
- Only one element per `layoutId` should be mounted at a time. If both exist,
  Motion crossfades them — which is the failure mode you were avoiding.

Known limitations: SVG unsupported, `display: inline` unsupported, an appearing
scrollbar triggers spurious layout animations (`scrollbar-gutter: stable`), and
layout animations are suppressed during horizontal window resize.

---

## Choreography

A transition needs **a subject**. If five things animate at once with the same
duration and curve, none of them is the subject and the screen just churns.

The lightbox open, as staged:

```
t=0      backdrop begins fading            (ambient, linear-ish)
t=0      the card begins its morph          ← the subject
t=180ms  chrome fades in                    (close, prev/next, caption)
```

Close reverses *and compresses*: chrome out → morph home → backdrop out.

Stagger caps at **8 items / 240ms**. Past that the stagger stops being rhythm and
becomes latency — the last card arriving two seconds after the first is a bug the
user experiences as slowness. `gridStagger()` enforces the cap.

---

## Frame-rate independence — the lerp rule

The naive smoothing everyone writes is **wrong**:

```ts
current += (target - current) * 0.1   // ✗ frame-rate dependent
```

It runs 2.4× faster on a 144Hz display than on a 60Hz one, because it applies
once *per frame* rather than per unit of time. Same bug as advancing a scroll
position by "22 pixels per frame".

The correct form is exponential decay, parameterised by half-life:

```ts
current = target + (current - target) * Math.pow(2, -dt / halfLife)
```

`dt` in seconds, from `requestAnimationFrame`'s timestamp, and **clamped** — a
backgrounded tab returns a `dt` of several seconds and will teleport the value.

**This applies to anything advancing state per frame**, not just lerps: drag
auto-scroll, cursor followers, parallax, scroll-linked progress, magnetic hover.
`lib/motion.ts` exports `dampHalfLife` for it. In React, prefer Motion's own
`useSpring` on a `useMotionValue` — it is frame-rate correct already.

---

## Accessibility

`prefers-reduced-motion` means **reduce, not remove** (WCAG SC 2.3.3). Cross-fade
instead of translate; keep opacity; kill parallax, spin, and large-distance
movement.

Three layers, all three in use:

1. `<MotionConfig reducedMotion="user">` in the root layout. Motion then skips
   transform and layout animations while leaving opacity and colour animating —
   which is the reduce-don't-remove principle for free.
2. `useReducedMotion()` per-component where the right reduction is a *different*
   animation rather than none.
3. A CSS block in `globals.css`, because third-party embeds and video never read
   the React config. It uses `0.01ms`, not `0` — so `transitionend` handlers
   still fire and nothing hangs waiting for them.

The escape hatch `transition={{ reduceMotion: false }}` (new in v13, undocumented
on the site) is for motion *essential to the information conveyed* — the exact
wording of the SC 2.3.3 exception. The studio's drag-reorder qualifies: if the
card does not visibly move, you cannot tell the reorder happened.

---

## Anti-patterns

- Linear easing on UI. Nothing physical moves at a constant speed.
- Animating `width`/`height`/`top`/`left` — layout on every frame.
- Over ~500ms on anything frequent. It is charming once and infuriating daily.
- Non-interruptible animations. If a user can click twice, handle the second one.
- Bouncing everything. Bounce is an accent; used everywhere it is noise.
- Scroll handlers that do work outside a rAF.
- Motion that blocks input.
- Staggering a long list so the last item arrives seconds in. Cap it.

---

## Open question, deliberately not acted on

`motion@13.1.1` ships an **undocumented View Transitions morph API**
(`ViewTransitionTarget`, with `layout`/`enter`/`exit`/`new`/`old` targets and an
`interrupt: "wait" | "immediate"` option — `index.d.ts:3935–4060`). It is a
genuine alternative to `layoutId` for cross-route morphs in the App Router, which
is exactly what the card → lightbox is. It deserves its own investigation before
the lightbox is considered finished; it was out of scope for the 2026-09-04 pass.
