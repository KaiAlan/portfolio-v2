# Research — web motion design: the actual numbers

**Date:** 2026-09-04
**Status:** reference. Not a decision record — the decisions live in §9.
**Verified against:** `motion@13.1.1` / `framer-motion@13.1.1` / `motion-dom` as
installed in this repo, Next 16.3.2, React 19.2.8.

Every number below is either quoted from a primary source with a link, or read
directly out of the installed package source (path + line given). Where a widely
repeated number has no findable owner, it is labelled **unsourced** rather than
asserted.

---

## 0. Source ledger

| Claim area | Owner | What it actually provides |
| --- | --- | --- |
| Easing tokens | [material-foundation/material-tokens `json/motion.json`](https://github.com/material-foundation/material-tokens/blob/json/json/motion.json) | Machine-readable M3 tokens — the only place the exact bezier tuples exist as data. `m3.material.io` is a client-rendered SPA and returns no prose to a fetcher. |
| Emphasized curve shape | [material-components-android `docs/theming/Motion.md`](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md) | Confirms `emphasized` is an SVG **path**, not a cubic-bezier |
| Enter/exit duration split | [m1.material.io — Duration & easing](https://m1.material.io/motion/duration-easing.html) | The only Google page that states enter vs exit durations numerically |
| Productive vs expressive | [carbondesignsystem.com/elements/motion/overview](https://carbondesignsystem.com/elements/motion/overview/) + [`carbon/packages/motion/src/dtcg/motion.json`](https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/dtcg/motion.json) | Prose + exact token values |
| Perception thresholds | [NN/g — Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/) | 0.1 s / 1 s / 10 s |
| Apple | [HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [SwiftUI `Animation.smooth/snappy/bouncy`](https://developer.apple.com/documentation/swiftui/animation/smooth(duration:extrabounce:)) | Qualitative HIG, **numeric** API defaults |
| Frame budget / pipeline | [web.dev — Rendering performance](https://web.dev/articles/rendering-performance), [web.dev — Animations guide](https://web.dev/articles/animations-guide) | 16.66 ms / 10 ms, the five-stage pipeline |
| `will-change` side effects | [W3C CSS Will Change Level 1](https://www.w3.org/TR/css-will-change-1/) | Containing-block creation, overuse warnings |
| Reduced motion | [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [WCAG 2.2 Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Spec wording + AAA criterion text |
| Frame-rate-independent lerp | [Rory Driscoll — Frame Rate Independent Damping using Lerp](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/), [Freya Holmér — *Lerp smoothing is broken*](https://www.youtube.com/watch?v=LSNQuFEDOyQ) | The derivation and both closed forms |
| Motion API | [motion.dev/docs](https://motion.dev/docs/react-transitions) + installed source | See §0.1 — the docs and the shipped code disagree in three places |

### 0.1 Docs-vs-shipped discrepancies (trust the shipped code)

Read from `node_modules/motion-dom/dist/motion-dom.dev.js:765–787` (`springDefaults`):

| Option | motion.dev says | `motion@13.1.1` ships |
| --- | --- | --- |
| `stiffness` | `1` | **`100`** (docs table is a typo) |
| `bounce` | `0.25` | **`0.3`** |
| `restSpeed` | `0.1` | **`0.01`** granular / `2` default |
| `restDelta` | `0.01` | **`0.005`** granular / `0.5` default |

`visualDuration` default is `0.3` s; `duration` default for a duration-spring is
`800` ms. The type definitions in `node_modules/motion-dom/dist/index.d.ts:2006–2062`
also disagree with the shipped constants — they are stale. Read the JS.

---

## 1. Easing curves

### 1.1 The rule that actually governs everything else

Every serious system splits easing three ways by **where the element is relative
to the viewport**, not by taste:

- **Decelerate / ease-out** — the element is *arriving* and stays visible. It
  starts fast, so the response looks immediate, then settles. This is the
  correct default for anything responding to input.
- **Accelerate / ease-in** — the element is *leaving* and will not be seen at
  rest. It starts slow, then whips off-screen. Nobody needs to read its final
  position, so ending fast costs nothing and saves time.
- **Symmetric (standard / ease-in-out)** — the element is visible at both ends
  and merely moves between two on-screen positions.

Carbon states the third case explicitly: use `standard-easing` "when an element
is visible from the beginning to the end of a motion. Expanding tiles and the
sorting of table rows are good examples"
([Carbon, Motion overview](https://carbondesignsystem.com/elements/motion/overview/)).
Material 3 encodes the same split as three named tokens —
`standard`, `standard.decelerate` (entering), `standard.accelerate` (exiting)
([material-components-android Motion.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).

**On "ease-in-out is wrong for most UI":** no primary source says that flatly, so
do not repeat it as a quote. What the sources *do* say is narrower and stronger:
a symmetric curve is specified only for the on-screen-at-both-ends case, and
every entering/exiting case gets an asymmetric curve instead. In a typical UI the
on-screen-at-both-ends case is the minority, which is where the folk rule comes
from. The genuinely sourced claim is: **CSS `ease-in-out` is the wrong default
because it is the answer to a question most UI transitions are not asking.**

Note also that the browser's own `ease` keyword — `cubic-bezier(0.25, 0.1, 0.25, 1)`
— is already ease-out-biased, not symmetric. Motion's default tween curve is a
deliberately shallower variant of it: `[0.25, 0.1, 0.35, 1]`
(`motion-dom.dev.js:3210–3215`, comment: "Default easing curve is a slightly
shallower version of the default browser easing curve").

### 1.2 Material Design 3 — exact token values

From [`material-tokens/json/motion.json`](https://github.com/material-foundation/material-tokens/blob/json/json/motion.json)
(float noise rounded; the raw JSON carries `0.20000000298023224` etc.):

```css
--md-sys-motion-easing-linear:                cubic-bezier(0, 0, 1, 1);
--md-sys-motion-easing-standard:              cubic-bezier(0.2, 0, 0, 1);
--md-sys-motion-easing-standard-decelerate:   cubic-bezier(0, 0, 0, 1);
--md-sys-motion-easing-standard-accelerate:   cubic-bezier(0.3, 0, 1, 1);
--md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
--md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
--md-sys-motion-easing-legacy:                cubic-bezier(0.4, 0, 0.2, 1);  /* = M2 "standard" */
--md-sys-motion-easing-legacy-accelerate:     cubic-bezier(0.4, 0, 1, 1);
--md-sys-motion-easing-legacy-decelerate:     cubic-bezier(0, 0, 0.2, 1);
```

**There is no `emphasized` cubic-bezier, and this matters.** The token JSON has
`emphasized.accelerate` and `emphasized.decelerate` but no plain `emphasized`,
because the full emphasized curve is a two-segment spline that no single cubic
bezier can express. Material publishes it as a path:

```
M 0,0 C 0.05,0 0.133333,0.06 0.166666,0.4 C 0.208333,0.82 0.25,1 1,1
```

([material-components-android Motion.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md).)
Read that path: it spends the first ~17 % of time covering 40 % of the distance,
then crawls the rest. It is a very aggressive front-loaded ease-out with a long
tail — a *spring shape drawn as a curve*. On the web you cannot use it as
`cubic-bezier()`. Your options are (a) approximate with `linear()` sampled from
the path, (b) split the transition into an accelerate-out then decelerate-in
pair, or (c) — recommended — just use a spring, which is what the curve is
imitating anyway. The commonly circulated `cubic-bezier(0.2, 0, 0, 1)` for
"emphasized" is actually `standard`; treat any source that calls it emphasized as
wrong.

### 1.3 IBM Carbon — productive vs expressive

Carbon's second axis is **tone**, orthogonal to direction. Verbatim from the
overview page:

> "Productive motion is appropriate for moments when the user needs to focus on
> completing tasks. Microinteractions in Carbon such as button states,
> dropdowns, revealing additional information, or rendering data tables and
> visualizations were all designed with productive motion."

> "Expressive motion delivers enthusiastic, vibrant, and highly visible
> movement. Use expressive motion for significant moments such as opening a new
> page, clicking the primary action button, or when the movement itself conveys
> a meaning."

Exact curves, from [`packages/motion/src/dtcg/motion.json`](https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/dtcg/motion.json)
(cross-checked against `packages/motion/src/tokens.ts`, which keeps a duplicate
numeric copy for JS engines):

| | productive | expressive |
| --- | --- | --- |
| `standard` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | `cubic-bezier(0.4, 0.14, 0.3, 1)` |
| `entrance` | `cubic-bezier(0, 0, 0.38, 0.9)` | `cubic-bezier(0, 0, 0.3, 1)` |
| `exit` | `cubic-bezier(0.2, 0, 1, 0.9)` | `cubic-bezier(0.4, 0.14, 1, 1)` |

The pattern is legible: expressive has a slower entry (`x1` 0.4 vs 0.2), a real
easing-in dip (`y1` 0.14 vs 0), and a fully-settled tail (`y2` 1 vs 0.9).
Productive's `y2: 0.9` means it *never quite decelerates to nothing* — it lands
with a slight abruptness that reads as efficiency. That is the whole trick.

Carbon also publishes the After Effects equivalents on the same page —
productive `standard` is "outgoing 20 %, incoming 62 %", expressive `standard` is
"outgoing 40 %, incoming 70 %".

### 1.4 Overshoot / back-out

Motion's built-in `backOut` is exactly
`cubic-bezier(0.33, 1.53, 0.69, 0.99)`, and `backIn` is its reverse
(`motion-dom.dev.js:2076`, `motion-utils.dev.js:235–237`). `anticipate` is
`backIn` mirrored — it dips *backwards* before moving forwards.

The `1.53` control point is the overshoot: the curve exceeds 1 and comes back.

**When overshoot is right:** an element that is *appearing* or being *emphasised*
— a toast, a badge, a like/save confirmation, a toggle knob, a drag release.
Overshoot reads as physical mass, which is exactly what those want.

**When overshoot is wrong, and this is the important half:**

- **Anything containing text you are about to read.** The overshoot makes the
  text move past its resting position and come back; the eye tracks it and has
  to re-fixate. Slower to read, measurably annoying.
- **Anything whose bounds must line up with something else** — a shared-element
  morph into a lightbox, a nav bar snapping to the top of the viewport, a card
  landing in a grid slot. Overshoot means the element visibly leaves the slot it
  is supposed to occupy. This is why the layout morph in §5.3 wants `bounce: 0`.
- **Exits.** An element leaving should not bounce first; it looks like it
  changed its mind. Use `backIn`/`anticipate` deliberately or not at all.
- **Any repeated, frequent interaction.** Bounce is a cost you pay on every
  repetition; it stops being charming around the fifth time.
- **Anything at the edge of a clipping container.** Overshoot on `scale` inside
  `overflow: hidden` produces a visible clip-then-unclip flicker.

Do not use `backOut` on cross-fading opacity: a bezier that overshoots 1 on
`opacity` clamps, so the "bounce" simply becomes a hold. It is wasted duration.

---

## 2. Duration

### 2.1 Perception floors and ceilings

The only genuinely primary numbers are Nielsen's, and they are about *system
response*, not animation length. Verbatim
([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)):

- **0.1 second** — "the limit for having the user feel that the system is
  reacting instantaneously".
- **1.0 second** — "the limit for the user's flow of thought to stay
  uninterrupted, even though the user will notice the delay".
- **10 seconds** — "the limit for keeping the user's attention focused on the
  dialogue".

The correct way to apply this to animation: **the animation must *begin* within
100 ms of the input**, and should be substantially readable well inside 1 s. A
300 ms transition does not violate the 0.1 s limit, because the system visibly
started reacting at ~0 ms. A 300 ms *delay before anything moves* does violate
it. This is why `delayChildren` on the first item of a stagger is almost always
wrong (§5.1).

Nielsen does **not** give an animation-duration ceiling. Anyone quoting "NN/g
says animations should be under 400 ms" is fabricating. The ceilings below come
from the design systems.

### 2.2 Material — two generations, two answers

Material 1/2 gave direct, useful numbers
([m1.material.io](https://m1.material.io/motion/duration-easing.html)):

- **Entering the screen: 225 ms. Leaving the screen: 195 ms.** (mobile)
- Typical mobile transition: **300 ms**.
- **Desktop should be 150–200 ms** — "shorter durations feel more responsive on
  larger screens with a mouse".
- Tablet **+30 %** on mobile (300 → 390 ms); wearables **−30 %** (300 → 210 ms).

Material 3 replaced this with a 16-step token scale and dropped the explicit
enter/exit numbers ([motion.json](https://github.com/material-foundation/material-tokens/blob/json/json/motion.json)):

| Token | ms | Token | ms | Token | ms | Token | ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `short1` | 50 | `medium1` | 250 | `long1` | 450 | `extra-long1` | 700 |
| `short2` | 100 | `medium2` | 300 | `long2` | 500 | `extra-long2` | 800 |
| `short3` | 150 | `medium3` | 350 | `long3` | 550 | `extra-long3` | 900 |
| `short4` | 200 | `medium4` | 400 | `long4` | 600 | `extra-long4` | 1000 |

M3's pairing guidance is one sentence, and it is the load-bearing one:
**"duration should increase as the area/traversal of an animation increases"**
([Motion.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).

### 2.3 Carbon — durations with stated purposes

From [`dtcg/motion.json`](https://github.com/carbon-design-system/carbon/blob/main/packages/motion/src/dtcg/motion.json),
`$description` fields quoted verbatim:

| Token | ms | Purpose |
| --- | --- | --- |
| `duration-fast-01` | **70** | "Micro-interactions such as button and toggle. Instant response to user action." |
| `duration-fast-02` | **110** | "Micro-interactions such as fade in. Subtle entrance or exit of small UI elements." |
| `duration-moderate-01` | **150** | "Micro-interactions, small expansion, short distance movements. Default transition speed." |
| `duration-moderate-02` | **240** | "Expansion, system communication, toast. Slightly longer interactions with more visual weight." |
| `duration-slow-01` | **400** | "Large expansion, important system notifications. Deliberate, prominent transitions." |
| `duration-slow-02` | **700** | "Background dimming, large hero transitions. Slow, immersive motion for maximum emphasis." |

### 2.4 The distance/size → duration relationship

Both systems agree on the direction and both say the mapping is **non-linear**.
Carbon is the more precise of the two, verbatim:

> "…distance (traveled) or size (scaling) of the element, the longer the
> animation takes."

> "Carbon uses a non-linear duration scale to achieve better perceived
> consistency across all distances."

Material 1:

> "Use longer durations when objects need to travel large distances or have
> dramatic changes in surface area."

**Neither publishes the formula.** Carbon points at an interactive "Motion
Generator" instead of stating one, and Material states only the qualitative rule.
So: the specific exponent is **unsourced**. What *is* sourced is that the scale
is sub-linear — Carbon's own tokens demonstrate it. Their durations are
70 / 110 / 150 / 240 / 400 / 700, i.e. each step is roughly ×1.5–1.7 while the
distances the steps cover grow much faster than that. A ~10× distance increase
buys roughly a 2–3× duration increase, not 10×.

A defensible working approximation, presented as *derived, not sourced*:

```
duration_ms ≈ base_ms × (distance_px / base_px) ^ 0.5
```

A square-root law reproduces Carbon's shape closely (70 ms for a ~20 px toggle
throw → ~400 ms for a ~700 px sheet) and matches the physical intuition that
perceived speed, not perceived time, is what should stay constant. Sanity-check
it by eye rather than trusting it.

### 2.5 Working numbers by interaction class

Synthesised from §2.2–2.4. Where Carbon and Material disagree, both are given.

| Class | Duration | Curve | Source basis |
| --- | --- | --- | --- |
| Hover / focus / press state feedback | **70–120 ms** | ease-out | Carbon `fast-01`/`fast-02` |
| Colour / opacity-only change | **100–150 ms** | ease-out or linear | Carbon `fast-02`/`moderate-01` |
| Small element enter (chip, tooltip, badge) | **150–200 ms** | decelerate | Carbon `moderate-01`; M3 `short3`/`short4` |
| Small element exit | **~110–150 ms** | accelerate | 195/225 ratio applied to the above |
| Dropdown / popover / menu | **150–240 ms** | decelerate in, accelerate out | Carbon `moderate-01`–`02` |
| Toast / snackbar | **240 ms** in | expressive entrance | Carbon `moderate-02` |
| Modal / sheet / drawer | **250–400 ms** | emphasized-decelerate in, emphasized-accelerate out | M3 `medium1`–`medium4`; Carbon `slow-01` |
| Backdrop dim behind a modal | **400–700 ms** | linear or standard | Carbon `slow-02` explicitly |
| Route / page transition | **300–500 ms** | emphasized | M3 `medium2`–`long2` |
| Large full-screen morph (card → lightbox) | **400–600 ms** | spring, `bounce: 0` | M3 `long1`–`long4`; area rule §2.4 |

**Ceilings.** For anything the user triggers repeatedly, keep it **≤ 300 ms**;
Material's own default transition is 300 ms and desktop guidance is 150–200 ms.
Above ~500 ms on a frequent interaction the animation stops being feedback and
starts being a wait. Reserve 700 ms+ for the once-per-session, deliberately
cinematic case (Carbon reserves `slow-02` for exactly that).

**Floors.** Below ~70 ms a transition is not perceived as motion, only as a
slightly soft state change — which is often fine and is why Carbon's fastest
token is 70 ms. Below ~30 ms it is indistinguishable from an instant swap; you
are paying complexity for nothing. There is no primary source for the 30 ms
figure — it follows from the 16.67 ms frame period (§6.1), which makes a 30 ms
animation about two frames long.

### 2.6 Where Material and Apple disagree

They disagree substantially, and it is a real disagreement, not a rounding error.

- **Material**: default 300 ms, desktop 150–200 ms, explicit numeric tokens
  centred on 200–400 ms.
- **Apple**: the [HIG's Motion page](https://developer.apple.com/design/human-interface-guidelines/motion)
  publishes **no durations at all**. It gives principles only — "Add motion
  purposefully"; "Aim for brevity and precision in feedback animations"; "In
  apps, generally avoid adding motion to UI interactions that occur frequently."
  The numbers live in the API instead, and there the default perceptual duration
  for all three SwiftUI spring presets is **0.5 s**:
  `static func smooth(duration: TimeInterval = 0.5, extraBounce: Double = 0.0)`
  ([SwiftUI Animation.smooth](https://developer.apple.com/documentation/swiftui/animation/smooth(duration:extrabounce:))).

So Apple's default motion is roughly **1.7× longer** than Material's. The
reconciliation is that they are measuring different things: Apple's `duration` is
a *perceptual* duration for a spring — "approximately equal to the settling
duration, but for very bouncy springs, will be the duration of the period of
oscillation" — and a spring reads as basically arrived well before it settles.
Material's is the literal end-to-end time of a bezier. A 0.5 s Apple spring and a
0.3 s Material bezier can look about equally fast. This is exactly the ambiguity
Motion's `visualDuration` exists to remove (§3.2).

Practical consequence: **do not compare a spring's `duration` to a tween's
`duration`.** Compare `visualDuration` to `duration`.

---

## 3. Spring physics

### 3.1 What the three physical parameters actually do

A damped harmonic oscillator: `mass · ẍ + damping · ẋ + stiffness · x = 0`.
Motion's shipped defaults (`motion-dom.dev.js:765–787`):
`stiffness: 100`, `damping: 10`, `mass: 1`, `velocity: 0`.

| Parameter | Raise it and… | Felt as |
| --- | --- | --- |
| `stiffness` (k) | the restoring force gets stronger; frequency rises as √k | "tighter", "snappier", "more urgent" |
| `damping` (c) | oscillation is absorbed faster | fewer/smaller bounces; too much = sluggish |
| `mass` (m) | inertia rises; frequency falls as 1/√m | "heavier", "more lethargic" — Motion's own doc word |

The number that governs *feel* is neither of these individually, it is the
**damping ratio** ζ = c / (2·√(k·m)):

- ζ < 1 — underdamped, overshoots and oscillates
- ζ = 1 — critically damped, fastest approach with **zero** overshoot
- ζ > 1 — overdamped, slow crawl into place, never overshoots

Motion's shipped defaults give ζ = 10 / (2·√100) = **0.5** — quite bouncy. That
is why untuned `type: "spring"` feels loose.

### 3.2 The `duration` + `bounce` parameterisation (prefer this)

Since v11 Motion exposes the spring by *time* and *bounce* instead, which is
identical in spirit to Apple's `spring(duration:bounce:)`. `bounce` maps to the
damping ratio directly — from `motion-dom.dev.js:806`:

```js
let dampingRatio = 1 - bounce;   // clamped to [0.05, 1]
```

So **`bounce: 0` is critically damped, `bounce: 0.3` is ζ = 0.7, `bounce: 1` is
undamped.** That is the whole mapping.

`visualDuration` is the better of the two time options. Motion's doc, verbatim:

> "The visual duration is a time, set in seconds, that the animation will take to
> visually appear to reach its target. In other words, the bulk of the transition
> will occur before this time, and the 'bouncy bit' will mostly happen after."

> "This makes it easier to edit a spring, as well as visually coordinate it with
> other time-based animations."

([motion.dev/docs/spring](https://motion.dev/docs/spring).) That last clause is
the practical reason to use it: a `visualDuration: 0.3` spring and a
`duration: 0.3` tween are directly comparable, so a spring and a bezier running
side by side actually agree.

`visualDuration` resolves through a closed form, not a solver
(`motion-dom.dev.js:894–905`) — this is exact and worth having:

```js
const root      = (2 * Math.PI) / (visualDuration * 1.2)
const stiffness = root * root
const damping   = 2 * clamp(0.05, 1, 1 - bounce) * Math.sqrt(stiffness)
// mass is forced to 1
```

Which gives you a conversion table (mass = 1 throughout):

| `visualDuration` | `bounce` | ⇒ `stiffness` | ⇒ `damping` | ζ |
| --- | --- | --- | --- | --- |
| 0.15 | 0 | 1218.5 | 69.8 | 1.0 |
| 0.20 | 0 | 685.4 | 52.4 | 1.0 |
| 0.20 | 0.2 | 685.4 | 41.9 | 0.8 |
| 0.25 | 0.2 | 438.6 | 33.5 | 0.8 |
| 0.30 | 0 | 304.6 | 34.9 | 1.0 |
| 0.30 | 0.3 | 304.6 | 24.4 | 0.7 |
| 0.35 | 0.2 | 223.8 | 23.9 | 0.8 |
| 0.45 | 0 | 135.4 | 23.3 | 1.0 |
| 0.55 | 0.25 | 90.6 | 14.3 | 0.75 |

Plain `duration` (no `visualDuration`) instead runs a 12-iteration Newton solve
(`findSpring`, `motion-dom.dev.js:801–870`) to hit a *settling* duration. Default
`duration` is **800 ms**, clamped to [0.01 s, 10 s].

`stiffness` / `damping` / `mass` **override** `duration` / `bounce` if both are
given (`motion-dom.dev.js:885–888`).

### 3.3 The interruption trap (undocumented, verify before relying on it)

`motion-dom.dev.js:889–893`, verbatim comment:

```js
// Time-defined springs should ignore inherited velocity.
// Velocity from interrupted animations can cause findSpring()
// to compute wildly different spring parameters, leading to
// massive oscillation on small-range animations.
springOptions.velocity = 0;
```

**A `duration`/`bounce`/`visualDuration` spring discards inherited velocity on
interruption. A `stiffness`/`damping` spring does not.** This is not in the
public docs and it inverts the usual advice: the whole reason to reach for a
spring on gesture-driven motion is velocity continuity, and the ergonomic
parameterisation is the one that throws it away.

Practical rule for this site:

- **Gesture-driven and velocity-critical** — drag release in the studio, a
  flick-dismissed lightbox — use `stiffness`/`damping` so the release inherits
  the throw velocity.
- **Everything else** — use `visualDuration` + `bounce` for legibility.

### 3.4 Motion's own implicit defaults

When you set no transition at all, Motion picks per value
(`motion-dom.dev.js:3192–3226`):

| Value | Default transition |
| --- | --- |
| `scale*` | `criticallyDampedSpring`: `stiffness: 550`, `damping: 30` (or `2√550 ≈ 46.9` when the target is `0`), `restSpeed: 10` |
| other transforms (`x`, `y`, `rotate`…) | `underDampedSpring`: `stiffness: 500`, `damping: 25`, `restSpeed: 10` → ζ ≈ 0.56 |
| everything else (colour, opacity…) | tween, `duration: 0.3`, `ease: [0.25, 0.1, 0.35, 1]` |
| >2 keyframes | `duration: 0.8`, `type: "keyframes"` |
| **`layout` animations** | **tween, `duration: 0.45`, `ease: [0.4, 0, 0.1, 1]`** (`motion-dom.dev.js:10326–10329`) |

Note the layout default is a *bezier*, not a spring, and 450 ms — Motion's own
authors reached for a deterministic curve for shared-element work. `[0.4, 0, 0.1, 1]`
is a slightly sharper M2 standard curve.

Drag momentum (`inertia`) defaults: `power: 0.8`, `timeConstant: 700`,
`bounceStiffness: 500`, `bounceDamping: 10`.

### 3.5 Spring vs bezier — the actual decision

**Spring when the animation can be interrupted or has a velocity to inherit.**
A bezier interrupted mid-flight has no way to blend; it either snaps or restarts
its curve from the current value, and both look wrong. A spring is defined by
current position + current velocity, so retargeting mid-flight is seamless.

- Drag release, flick, swipe-to-dismiss → **spring, physics params** (§3.3).
- Hover in/out on a card that the user is scrubbing across a grid → **spring**.
  The mouse leaves before the enter finishes constantly.
- Scroll-linked values → **spring** via `useSpring` (§4.5).
- Toggles, switches, anything with a "did they change their mind" window →
  **spring**.

**Bezier when the animation is choreographed, deterministic, or must end at a
known time.**

- Exit animations. `AnimatePresence` needs to know when to unmount; a spring's
  settle time is emergent and you end up with elements lingering. Motion's own
  layout default is a bezier for related reasons.
- Anything staggered across a list — you need to be able to compute total time.
- Anything synchronised to another timed thing (a video seek, a CSS transition
  you don't control, an audio cue in the music player).
- Cross-fades. Opacity has no physicality to convey; a spring on opacity is
  mostly wasted.

### 3.6 Concrete configs

```ts
// Layout morph, grid card → lightbox. Zero bounce: the destination bounds must
// line up with the real element, and text is being carried along inside it.
const morph = { type: "spring", visualDuration: 0.45, bounce: 0 } as const
// ≡ { stiffness: 135.4, damping: 23.3, mass: 1 }

// Modal / sheet. A whisper of bounce so it reads as arriving, not as being placed.
const sheet = { type: "spring", visualDuration: 0.35, bounce: 0.15 } as const

// Small toggle / switch knob / like button. Fast and slightly springy.
const toggle = { type: "spring", visualDuration: 0.2, bounce: 0.25 } as const
// ≡ { stiffness: 685.4, damping: 39.3, mass: 1 }

// Drag release. Physics params on purpose — this one MUST inherit velocity (§3.3).
const dragRelease = { type: "spring", stiffness: 400, damping: 35, mass: 1 } as const
// ζ = 35 / (2·√400) = 0.875 — settles clean, no visible bounce, keeps the throw.

// Drag momentum past the pointer release (free-scrolling reorder list):
const momentum = { power: 0.6, timeConstant: 500, modifyTarget: snapToRow } as const
```

---

## 4. Lerp, damped smoothing, and frame-rate independence

### 4.1 The naive pattern and why it is broken

```js
// WRONG
current += (target - current) * 0.1
```

Rory Driscoll's framing of the bug
([Frame Rate Independent Damping using Lerp](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/)):
this "consumes a chunk out between a and b *each frame*", so the smoothing rate
is per-*frame*, not per-*second*. Change the frame rate and you change the
physics.

Concretely, with factor 0.1, the fraction of the gap remaining after 100 ms:

| Refresh | frames in 100 ms | remaining = 0.9ⁿ |
| --- | --- | --- |
| 60 Hz | 6 | 0.531 |
| 120 Hz | 12 | 0.282 |
| 144 Hz | 14.4 | 0.219 |

The 120 Hz user's smoothing is roughly **twice as fast** as the 60 Hz user's. On
a ProMotion iPhone or a 144 Hz monitor your cursor follower is tighter, your
smooth scroll is stiffer, and your parallax lags less than you designed. Worse,
it drifts *within* a session: the same code feels different during a heavy
paint. And multiplying the factor by `dt` does not fix it — the parameter can
then exceed 1, which Driscoll notes is invalid (it overshoots and can oscillate).

### 4.2 The correct closed form

Reframe as: *how much of the gap should remain after one second?* Then the decay
is continuous and `dt` need not be an integer number of frames. Driscoll gives
both forms:

```csharp
// rate form
public static float Damp(float source, float target, float smoothing, float dt)
{
    return Mathf.Lerp(source, target, 1 - Mathf.Pow(smoothing, dt))
}

// lambda / exponential form — identical results
public static float Damp(float a, float b, float lambda, float dt)
{
    return Mathf.Lerp(a, b, 1 - Mathf.Exp(-lambda * dt))
}
```

Freya Holmér's *[Lerp smoothing is broken](https://www.youtube.com/watch?v=LSNQuFEDOyQ)*
(Guadalindie 2024) derives the same result and adds the parameterisation worth
actually shipping — **half-life**, the time for the gap to halve. It is the only
one of the three that a designer can reason about directly.

In JS, all three forms, exact:

```ts
// dt in SECONDS. All three are equivalent; pick by which parameter reads best.

/** lambda: decay rate per second. Higher = snappier. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  target + (current - target) * Math.exp(-lambda * dt)

/** halfLife: seconds for the remaining distance to halve. Most legible. */
export const dampHalfLife = (current: number, target: number, halfLife: number, dt: number) =>
  target + (current - target) * Math.pow(2, -dt / halfLife)

/** smoothing: fraction of the gap REMAINING after 1 second, in (0, 1). */
export const dampRate = (current: number, target: number, smoothing: number, dt: number) =>
  target + (current - target) * Math.pow(smoothing, dt)
```

Conversions: `lambda = ln(2) / halfLife ≈ 0.6931 / halfLife`;
`smoothing = exp(-lambda)`.

### 4.3 The `1 - Math.pow(1 - t, dt * 60)` approximation

This is the *port* of an existing 60 Hz-tuned constant, and it is worth being
precise about what it is:

```ts
// Given a factor `t` that was hand-tuned at 60fps, reproduce that exact feel
// at any refresh rate. dt in seconds.
const factor = 1 - Math.pow(1 - t, dt * 60)
current += (target - current) * factor
```

This is exactly `dampRate` with `smoothing = (1 - t) ** 60`. It is not an
approximation of anything in the mathematical sense — it is algebraically the
same closed form, re-parameterised so your existing magic number keeps meaning
what it meant. Use it when you are fixing legacy code and want to preserve the
feel byte-for-byte; use `dampHalfLife` when writing new code.

Always clamp `dt`. A backgrounded tab or a GC pause hands you a `dt` of 2
seconds and the "smooth" follower teleports:

```ts
const dt = Math.min((now - last) / 1000, 1 / 30)  // never trust dt past ~33ms
```

### 4.4 Where this matters on this site

| Feature | Why lerp | Suggested half-life |
| --- | --- | --- |
| Smooth scroll (if Lenis is added — it is **not** currently a dependency) | Lenis's `lerp` option is precisely the naive per-frame factor. Check whether the installed version has been made `dt`-aware before trusting it across refresh rates. | ~0.08 s |
| Cursor follower / magnetic hover | The lag *is* the effect; frame-rate dependence changes the effect | 0.05–0.10 s |
| Parallax on the masonry feed | Frame-rate-dependent parallax desyncs from the scroll position at high Hz | 0.06 s |
| Scroll-hiding nav bar | You are damping a *decision* (scroll direction), so damp the velocity signal, not the transform | 0.12 s on velocity |
| Music-player progress / waveform | Must track real playback time — damp the *display*, never the source of truth | 0.05 s |

The nav bar deserves a note. Hiding on scroll-down and showing on scroll-up is a
sign-of-velocity decision, and raw scroll velocity is noisy enough to flicker at
the direction boundary. Damp the velocity before thresholding it, and gate on a
minimum magnitude — do not damp the nav's `y` transform to hide the flicker,
because that just makes a flickering nav flicker slowly.

### 4.5 The React-idiomatic version

Motion's motion values are the same machinery with the plumbing done. Everything
here runs off the main React tree — a motion value updating does **not** trigger
a re-render, which is the entire performance argument.

```tsx
import { useScroll, useSpring, useTransform, useVelocity, useMotionValueEvent } from "motion/react"

// useScroll returns scrollX/scrollY (absolute px) and scrollXProgress/
// scrollYProgress (0–1 between the configured offsets).
const { scrollY, scrollYProgress } = useScroll()

// useSpring IS the damped smoothing, physically parameterised. This is the
// replacement for hand-rolled lerp in 90% of cases.
const smoothProgress = useSpring(scrollYProgress, {
  stiffness: 120, damping: 30, mass: 1,   // ζ = 30/(2·√120) = 1.37, overdamped: no overshoot
  restDelta: 0.001,
})

// Derived values are free — no re-render, no rAF loop of your own.
const parallaxY = useTransform(smoothProgress, [0, 1], ["0%", "-12%"])

// Velocity for the scroll-hiding nav.
const scrollVelocity = useVelocity(scrollY)
const smoothVelocity = useSpring(scrollVelocity, { stiffness: 400, damping: 90 })
useMotionValueEvent(smoothVelocity, "change", (v) => {
  if (Math.abs(v) < 120) return          // deadband — kills boundary flicker
  setNavHidden(v > 0 && scrollY.get() > 80)
})
```

Two caveats from the installed source and docs:

- `useSpring` accepts `skipInitialAnimation` (default `false`). For a value
  seeded from scroll position on mount you almost always want `true`, otherwise
  the page springs from 0 to the restored scroll offset on load
  ([motion.dev/docs/react-use-spring](https://motion.dev/docs/react-use-spring)).
- `useScroll`'s `trackContentSize` defaults to `false` "due to minor overhead".
  A masonry feed that grows as images decode **needs** it, or `scrollYProgress`
  will be computed against a stale document height.

Prefer `useSpring` over a hand-rolled damp unless you specifically need
half-life semantics or non-numeric interpolation. Motion's spring already
integrates with `dt` correctly and already handles interruption.

---

## 5. Choreography and staging

### 5.1 Stagger

Motion v13 exposes `stagger()` as a first-class function used through
`delayChildren` ([motion.dev/docs/stagger](https://motion.dev/docs/stagger)):

```js
stagger(duration, { startDelay = 0, from = "first", ease = "linear" })
```

`from` accepts `"first" | "center" | "last" | number`. `ease` **redistributes**
the delays across the total window rather than easing each child — a subtle and
useful thing: `stagger(0.1, { ease: "easeOut" })` bunches the later items up.

React usage — note this is `delayChildren`, not `staggerChildren`:

```jsx
const container = {
  open: { opacity: 1, transition: { delayChildren: stagger(0.05, { from: "first" }) } },
}
```

`staggerChildren` / `staggerDirection` still exist as orchestration keys in the
installed build (`motion-dom.dev.js:3229–3240`) but `stagger()` in
`delayChildren` is the v13 idiom and the only one that supports `from` and
`ease`.

**The ms values.** No primary design-system source publishes stagger increments —
Material, Carbon and Apple all discuss choreography qualitatively only. Marked
**unsourced**; the following is derived from Motion's own doc examples
(`stagger(0.1)`, `stagger(0.05)`) plus the arithmetic constraint below.

| Increment | Reads as | Use for |
| --- | --- | --- |
| **20–40 ms** | one group with texture — you perceive a single arrival that has grain | Grid/masonry cards, a row of icons, anything ≥ 8 items |
| **50–80 ms** | a deliberate cascade — you perceive order | Menu items, a short list (4–8), a settings panel |
| **100–150 ms** | a queue — you count the items | 3–5 items max, when sequence is the message |
| **> 150 ms** | a wait | Almost never |

The constraint that actually decides it: **total stagger window should not
exceed the duration of a single child's animation by more than ~2×, and should
never exceed ~500 ms.** With a 200 ms child animation, a 12-item grid at 40 ms
finishes at 200 + 11×40 = 640 ms — already at the edge. At 100 ms it finishes at
1.3 s, which is a source of the "last item arrives seconds later" anti-pattern
(§8).

For a masonry feed of unknown length, **cap the stagger**:

```jsx
// Stagger the first N, then everything else arrives together.
transition: { delayChildren: stagger(0.03) }   // and only animate the visible viewport's worth
// or explicitly:
delay: Math.min(i * 0.03, 0.24)
```

Cap at 8 items / ~240 ms. Beyond that the stagger has stopped communicating and
is just latency.

### 5.2 Exits are faster than entrances

The only primary numeric source is Material 1: **entering 225 ms, leaving
195 ms** ([m1.material.io](https://m1.material.io/motion/duration-easing.html)) —
a ratio of **0.87**. M3 dropped the explicit numbers but encodes the same idea
structurally by pairing `emphasized-decelerate` with entries and
`emphasized-accelerate` with exits, and Carbon does the same with
`entrance`/`exit`.

In practice the useful ratio is more aggressive than 0.87, because the reasoning
is not symmetric: an entering element must be *read* at its destination, an
exiting one must not. **0.6–0.8× the entrance duration** is a good working range,
and the folk rule "exits at half the entrance" is defensible but **unsourced**.
Anchor on 0.87 if you want to be able to cite it.

Also: exits should use a bezier, not a spring (§3.5), and `AnimatePresence`
should generally use `mode="wait"` for a route-level or modal-level swap so the
entering element does not fight the leaving one for space
([motion.dev/docs/react-animate-presence](https://motion.dev/docs/react-animate-presence)):

- `"sync"` (default) — "elements animate in and out as soon as they're added/removed"
- `"wait"` — "the entering element will **wait** until the exiting child has animated out, before it animates in"
- `"popLayout"` — "Exiting elements will be 'popped' out of the page layout, allowing surrounding elements to immediately reflow"

For a masonry feed where deleting a shot should let the grid close up
immediately, `popLayout` is the right one. For the lightbox, `wait`.

### 5.3 Shared-element / `layoutId` morphs

**How it works, and why that constrains you.** Motion measures the element's
bounding box before and after, then animates the difference using
`transform: translate + scale` — never `width`/`height`. That is what makes it
cheap (§6). The price is that everything inside the element is being scaled too,
so it distorts.

The three corrections Motion applies or offers:

1. **`borderRadius`** — corrected as a *percentage*, not pixels. From the source
   comment (`motion-dom.dev.js:7477–7481`): "We always correct borderRadius as a
   percentage rather than pixels to reduce paints. For example, if you are
   projecting a box that is 100px wide with a 10px borderRadius into a box that
   is 200px wide with a 20px borderRadius, that is actually a 10% borderRadius
   in both states." Consequence: **the correction only fires if `borderRadius`
   is set via `style` (or an animated value), not via a CSS class or a Tailwind
   `rounded-*` utility.** This is the single most common cause of a morph whose
   corners visibly squash. Set it inline.
2. **`boxShadow`** — same deal, `correctBoxShadow` at `motion-dom.dev.js:7549`,
   same inline-style requirement.
3. **Children** — add `layout` to immediate children so they counter-scale.

**`layout` prop values** (`motion-dom/dist/index.d.ts:898`, richer than the
public docs — there are six, not three):

```ts
layout?: boolean | "position" | "size" | "preserve-aspect" | "x" | "y"
```

From the type docs verbatim:

- `true` — animate size and position.
- `"position"` — "the size of the component will change instantly and only its
  position will animate".
- `"size"` — "the position of the component will change instantly and only its
  size will animate".
- `"preserve-aspect"` — "the component will animate size & position if the
  aspect ratio remains the same between renders, and just position if the ratio
  changes".
- `"x"` / `"y"` — undocumented on motion.dev; single-axis layout animation.

**Which to use.** `"preserve-aspect"` is the correct default for a
cosmos-style feed and is under-used: shots in a masonry grid have varying
aspect ratios, and it degrades to a position-only animation exactly when a full
morph would have distorted. For **text**, use `"position"` — scaling a text node
smears the glyphs and, worse, if the text reflows to a different line count
between states the morph has no continuous interpretation at all.

**What makes a morph read as continuous rather than as a crossfade:**

- The element must be the *same visual content* at both ends. A grid card
  showing a cropped 4:3 thumbnail morphing into a full 3:2 image is not the same
  content, and the eye reads the mismatch as a crossfade with extra steps. Fix
  by matching `object-fit`/`object-position` at both ends, or by morphing a
  wrapper and cross-fading the image inside it.
- Aspect ratio must be continuous. If it is not, `"preserve-aspect"` and accept
  position-only.
- The corners must track (see `borderRadius` above).
- **`bounce: 0`.** Overshoot on a morph means the element leaves the bounds it is
  morphing into and comes back — the illusion that this *is* the same object
  breaks the moment it overshoots its own destination.
- Both elements need the same `layoutId` and only one should be mounted at a
  time where possible. Motion's docs: "If both exist simultaneously, they
  crossfade" — which is precisely the failure mode you are trying to avoid.

**Known limitations** ([motion.dev/docs/react-layout-animations](https://motion.dev/docs/react-layout-animations)):
SVG is unsupported; `display: inline` elements do not work; a scrollbar appearing
triggers spurious layout animations (fix with `scrollbar-gutter: stable`);
layout animations are suppressed during horizontal window resize.

### 5.4 Not everything at once

The compositional rule, stated by Carbon as the reason expressive motion exists
and by Apple as "aim for brevity and precision": a transition should have a
**subject**. If five things animate simultaneously with the same duration and
curve, none of them is the subject and the screen just churns.

Practical shape for the lightbox open:

1. `t=0` — backdrop starts fading (400 ms, linear-ish; Carbon `slow-02` reasoning)
2. `t=0` — the card begins its morph (450 ms spring, `bounce: 0`) — **the subject**
3. `t=~180 ms` — chrome (close button, caption, next/prev) fades in over 150 ms

The chrome delay is the choreography. It arrives after the morph is legible, so
the eye tracks one thing and then finds the controls. Reverse and compress on
close: chrome out (100 ms) → morph back (350 ms) → backdrop out.

---

## 6. Performance

### 6.1 The budget

[web.dev, Rendering performance](https://web.dev/articles/rendering-performance), verbatim:

> "the browser has 16.66 milliseconds to produce each frame. In reality, though,
> the browser has its own overhead for each frame, so all of your work needs to
> be completed inside **10 milliseconds**."

At 120 Hz the frame period is 8.33 ms, so by the same 60 % ratio you have roughly
**5 ms**. (The 8.33 ms is arithmetic; the 5 ms is my extrapolation of web.dev's
overhead ratio, not a published figure.) This is why compositor-thread animation
is not an optimisation but a requirement on high-refresh displays — the main
thread cannot reliably hit 5 ms while React is doing anything at all.

### 6.2 The pipeline and what triggers what

web.dev's five stages: **JavaScript → Style → Layout → Paint → Composite**, with
three pathways:

| Pathway | Stages run | Example properties |
| --- | --- | --- |
| Layout | Style → Layout → Paint → Composite | `width`, `height`, `top`, `left`, `right`, `bottom`, `margin`, `padding`, `border-width`, `font-size`, `display`, `position`, `float`, `flex`/`grid` sizing |
| Paint | Style → Paint → Composite | `color`, `background-color`, `background-image`, `background-position`, `border-radius`, `box-shadow`, `outline`, `visibility`, `text-shadow` |
| Composite | Style → Composite | **`transform`, `opacity`** |

web.dev's guidance, verbatim: "Where possible, restrict animations to `opacity`
and `transform` to keep animations on the compositing stage", and "Avoid any
property that triggers layout or paint unless it's absolutely necessary"
([web.dev, Animations guide](https://web.dev/articles/animations-guide)).

Note `filter` and `clip-path` are absent from web.dev's two-property rule but
*are* in Motion's own hardware-accelerated set
(`framer-motion.dev.js:2857–2863`):

```js
const acceleratedValues = new Set(["opacity", "clipPath", "filter", "transform", "backgroundColor"])
```

Motion will hand these to WAAPI so they run off the main thread. They are still
paint-expensive on some GPUs (`filter: blur()` especially, at large radii on
large surfaces — relevant to a full-bleed feed with a frosted nav). Treat
`opacity`/`transform` as free, `clipPath`/`filter` as usable-but-measure, and
`backgroundColor` as fine only because it is cheap to repaint, not because it
skips paint.

### 6.3 `will-change` and layer promotion

The spec's own warning is unusually direct
([W3C css-will-change-1](https://www.w3.org/TR/css-will-change-1/)):

> "A common initial response to seeing will-change is to assume that code like
> this is a good idea: `* { will-change: transform, opacity; }` Wrong."

> "the stronger optimizations … can cause the page to slow down or even crash"

> "Most of those optimizations need time to be applied, and so they don't have
> enough time to set-up when this is done, and the will-change has little to no
> effect."

That last one is the timing trap: `will-change` applied in the same frame as the
animation starts does nothing. web.dev's rule of thumb is to apply it to
elements you plan to animate "within the next 200ms", then remove it.

**The containing-block trap**, and this one has already bitten this codebase
(see the `framer-effects-trap-fixed-children` memory). Spec, verbatim:

> "If any non-initial value of a property would create a stacking context on the
> element, specifying that property in will-change must create a stacking context
> on the element."

The same applies to **containing blocks for absolutely and fixed positioned
elements**. So `will-change: transform` on an ancestor makes every
`position: fixed` descendant position relative to *that ancestor*, not the
viewport. A fixed nav bar or a fixed lightbox inside a `will-change`d container
silently stops being fixed. `transform: translateZ(0)` has the identical effect
for the identical reason — it is a non-`none` transform, and non-`none`
transforms have always created a containing block for fixed descendants.

Rules for this site:

- Never put `will-change` (or `translateZ(0)`, or any transform) on an ancestor
  of the fixed nav or the lightbox portal.
- Add `will-change` on hover-intent, not statically. `.card:hover { will-change: transform }`
  is fine because the hover precedes the animation by more than a frame.
- A full-bleed masonry feed can easily have 200 cards. `will-change` on all of
  them is 200 composited layers, which is exactly the crash the spec warns about.
  Promote the ~1 card being hovered, not the grid.

### 6.4 Why Motion's `layout` is safe

Motion's layout animation measures the before/after bounding boxes and then
animates the delta with `transform: translate + scale` — the layout property
change is applied instantly and only the *visual* difference is animated. So a
"width animation" written as `layout` runs entirely on the composite pathway,
while the same animation written as `animate={{ width }}` runs the full
layout→paint→composite pipeline every frame.

The distortion corrections in §5.3 are the cost of that trick: because it is a
scale, children stretch and radii squash, and Motion has to undo it. Understanding
the trick is what tells you the corrections are not optional polish — they are
repairing damage the technique necessarily causes.

### 6.5 Video in the feed

Hover-to-play video is not covered by any of the above and is the likeliest
source of jank on this specific site:

- Decoding is off-main-thread but **compositing many video layers is not free**.
  A grid where every card holds a `<video>` — even paused — creates a layer per
  video. Mount the `<video>` on hover intent and swap back to a poster on leave,
  rather than rendering all of them.
- `play()` returns a promise that rejects if the element is removed or paused
  before it resolves. On a grid the user sweeps across, that rejection fires
  constantly. Catch it and no-op.
- Debounce hover intent by ~80–120 ms before starting playback. Sweeping across
  ten cards should start zero videos.

---

## 7. Accessibility

### 7.1 What `prefers-reduced-motion` actually means

MDN, quoting the spec: `reduce` "indicates that a user has enabled the setting on
their device for reduced motion", and `@media (prefers-reduced-motion)` is
equivalent to `@media (prefers-reduced-motion: reduce)`. The setting exists "to
convey to the browser on the device that the user prefers an interface that
removes, **reduces, or replaces** motion-based animations"
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).

**It means reduce, not remove.** MDN's own worked example replaces a `scale()`
pulse with an opacity dissolve rather than deleting the animation, and identifies
the actual trigger: "Animations such as scaling or panning large objects can be
vestibular motion triggers."

What that translates to concretely:

| Keep | Reduce | Remove |
| --- | --- | --- |
| `opacity` cross-fades | large `translate` → small `translate` or none | parallax |
| colour transitions | `scale` morphs → cross-fade at final size | continuous spin/orbit |
| very small (< ~8 px) movement | long durations → short | auto-playing background video |
| state feedback on press/hover | staggers → simultaneous | zoom-on-scroll |

Note the third column contains the two things this site does most: the parallax
in a cosmos-style feed and the `layoutId` morph. The morph does not need to be
deleted — it needs to become a cross-fade between the card and the lightbox at
their final positions, which preserves the *meaning* (this thing became that
thing) while removing the *travel*.

### 7.2 WCAG

**SC 2.3.3 Animation from Interactions (Level AAA)**, verbatim
([Understanding SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)):

> "Motion animation triggered by interaction can be disabled, unless the
> animation is essential to the functionality or the information being conveyed."

The Understanding document names parallax specifically as "often non-essential",
and is blunt about the stakes: "Triggered reactions include nausea, migraine
headaches, and potentially needing bed rest to recover."

It is AAA, so a portfolio is not obliged to meet it. Meet it anyway — honouring
`prefers-reduced-motion` is the whole of the work and it is about fifteen lines.

**SC 2.2.2 Pause, Stop, Hide (Level A)** is the one that *is* obligatory, and it
covers *automatically starting* motion that lasts more than five seconds and runs
in parallel with other content. On this site that is the auto-playing video in
the feed, if any of it autoplays without hover. Either keep it under 5 s, or
provide a pause control.

### 7.3 Implementation in Motion

Three layers, use all three.

```tsx
// 1. App-wide default. "user" respects the OS setting; "always"/"never" force it.
//    Type: ReducedMotionConfig = "always" | "never" | "user"  (framer-motion/index.d.ts:208)
<MotionConfig reducedMotion="user">{children}</MotionConfig>
```

What that actually does, from the installed source: it flips
`shouldReduceMotion` on each visual element, which makes Motion **skip transform
and layout animations** (setting `duration = 0`, `type = "keyframes"` —
`framer-motion.dev.js:7108–7112`) while leaving non-transform values such as
`opacity` and colour animating normally. That is the correct default behaviour
and it matches the reduce-don't-remove principle for free. Note the `"never"` and
`"always"` branches skip installing the `matchMedia` listener entirely.

```tsx
// 2. Per-component, for the cases where you want a different reduction than
//    "skip the transform" — e.g. cross-fade instead of nothing at all.
const reduce = useReducedMotion()
<motion.div
  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={reduce ? { duration: 0.15 } : { type: "spring", visualDuration: 0.35, bounce: 0.15 }}
/>
```

Motion's own guidance is to replace "potentially motion-sickness inducing `x`/`y`
animations with `opacity`, disabling the autoplay of background videos, or
turning off parallax motion"
([motion.dev/docs/react-use-reduced-motion](https://motion.dev/docs/react-use-reduced-motion)).

```tsx
// 3. New in v13 and not on the docs site: a per-transition escape hatch.
//    `reduceMotion?: boolean` — true skips transform/layout animations,
//    false always animates them, undefined defers to the device preference.
//    (motion-dom/dist/index.d.ts:2345-2354)
<motion.div layout transition={{ reduceMotion: false }} />
```

Use `reduceMotion: false` sparingly and only where the motion is genuinely
*essential to the information conveyed* — which is the exact wording of the SC
2.3.3 exception. A drag-and-drop reorder in the studio arguably qualifies: if the
card does not visibly move, the user cannot tell the reorder happened.

Finally, cover the CSS side too — third-party embeds and video will not read your
React config:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

(Use `0.01ms` rather than `0`, so `animationend`/`transitionend` handlers still
fire and nothing hangs waiting for them.)

---

## 8. Anti-patterns

Each with the reason, because "don't do X" without the mechanism doesn't survive
contact with a deadline.

1. **`linear` easing on anything that moves.** Nothing in the physical world
   starts and stops instantaneously, so linear motion reads as mechanical.
   Carbon: "Strictly linear movement appears unnatural to the human eye." The
   *exceptions* are real and worth knowing: linear is correct for continuous
   rotation (a spinner), for colour/opacity crossfades where there is no implied
   motion, and for scroll-linked values where the "easing" is the scroll itself.

2. **Animating `width`, `height`, `top`, `left`, `margin`.** Every frame runs
   layout → paint → composite for the whole subtree (§6.2). Use `transform`, or
   Motion's `layout` which does it for you (§6.4).

3. **Durations over ~500 ms on frequent interactions.** Material's desktop
   guidance is 150–200 ms and Apple's is "generally avoid adding motion to UI
   interactions that occur frequently". The cost is paid on every repetition, and
   after the third repetition the user is not watching the animation, they are
   waiting for it.

4. **Non-interruptible animations.** Apple: "Let people cancel motion. As much as
   possible, don't make people wait for an animation to complete before they can
   do anything, especially if they have to experience the animation more than
   once." The technical form: never gate state changes on `onAnimationComplete`
   for anything the user can re-trigger. Use springs where retargeting is
   frequent (§3.5).

5. **Bouncing everything.** Overshoot is a strong signal and it is consumed by
   repetition. It also actively breaks morphs, alignment, and text legibility
   (§1.4). Motion's *default* spring is ζ = 0.5, which is bouncier than most UI
   wants — an untuned `type: "spring"` everywhere is this anti-pattern by
   accident.

6. **Animating on every scroll event without rAF.** `scroll` fires more often
   than the browser paints, and each handler that reads layout
   (`getBoundingClientRect`, `offsetTop`, `scrollHeight`) forces a synchronous
   reflow — layout thrash, and the 10 ms budget is gone. Read in one place, write
   in another, and drive from `requestAnimationFrame` — or just use `useScroll`,
   which already does this.

7. **Motion that blocks input.** An overlay that fades in over 400 ms while
   `pointer-events` are already on it eats the click that arrives at 200 ms.
   Either set `pointer-events: none` until the entrance completes, or accept the
   click immediately and let the animation catch up. The second is better.

8. **Long staggered lists.** 30 items at 100 ms means the last one arrives at
   3 seconds. The user has finished reading item 1 and is looking at an empty
   space. Cap the stagger (§5.1) and only stagger what is in the viewport.

9. **`will-change` left on permanently, or applied broadly.** A layer per element
   costs GPU memory and can crash the page (§6.3), and it silently breaks
   `position: fixed` descendants.

10. **Frame-rate-dependent lerp.** Ships as a bug that only appears on hardware
    you don't own (§4.1).

11. **Springs on exit animations.** A spring's settle time is emergent, so
    `AnimatePresence` either unmounts early (visible pop) or waits for
    `restDelta` (visible lingering). Use a bezier with a known duration.

12. **Animating from `opacity: 0` on above-the-fold content.** The content is
    invisible until JS hydrates. On a slow connection that is a blank hero. Let
    the first viewport render at rest and animate only what enters on scroll.

13. **Radii set by class instead of inline style during a layout morph.** Motion's
    correction only fires on `style`-set or animated `borderRadius`
    (§5.3) — the Tailwind `rounded-2xl` version squashes visibly.

14. **A single global `transition-all`.** It animates properties you did not
    intend, including layout ones, and it fires on every class change including
    ones that should be instant.

---

## 9. Recommended defaults for this site

An opinionated token set. Named for what it is *for*, not what it *is* — a token
called `--ease-exit` survives a redesign, one called `--ease-cubic-4` does not.

### 9.1 Easings

```css
:root {
  /* Direction. Carbon productive — the y2:0.9 tail lands with a slight
     abruptness that reads as responsive. Right for a work-focused feed. */
  --ease-standard: cubic-bezier(0.2, 0, 0.38, 0.9);   /* on-screen at both ends */
  --ease-entrance: cubic-bezier(0, 0, 0.38, 0.9);     /* arriving */
  --ease-exit:     cubic-bezier(0.2, 0, 1, 0.9);      /* leaving */

  /* Tone. Carbon expressive — for the once-per-visit moments. */
  --ease-entrance-expressive: cubic-bezier(0, 0, 0.3, 1);
  --ease-exit-expressive:     cubic-bezier(0.4, 0.14, 1, 1);

  /* Motion's own default tween curve — use where you want to match its
     implicit behaviour rather than fight it. */
  --ease-default:  cubic-bezier(0.25, 0.1, 0.35, 1);

  /* Overshoot. Motion's backOut. Use on ONE thing per screen, never on
     text, morphs, or anything that must land on a boundary. */
  --ease-overshoot: cubic-bezier(0.33, 1.53, 0.69, 0.99);
}
```

Rationale for Carbon over Material 3: M3's headline `emphasized` curve is a
two-segment path that cannot be expressed as CSS `cubic-bezier()` at all (§1.2),
so adopting M3 on the web means either approximating it or falling back to
`standard`, which is `cubic-bezier(0.2, 0, 0, 1)` — a curve with a *zero* x2, i.e.
an extremely long tail that reads as slightly floaty on a dense grid. Carbon's
productive set is web-native, complete, and tuned for exactly the "user is here to
look at work" case.

### 9.2 Durations

```css
:root {
  --dur-instant: 70ms;    /* hover, focus ring, press — Carbon fast-01 */
  --dur-fast:    120ms;   /* small fades, icon swaps — Carbon fast-02 */
  --dur-base:    180ms;   /* the default. Dropdowns, chips, tooltips */
  --dur-slow:    280ms;   /* panels, popovers, toasts — Carbon moderate-02 */
  --dur-page:    420ms;   /* route change, lightbox chrome */
  --dur-ambient: 700ms;   /* backdrop dim, hero — Carbon slow-02 */

  /* Exits are 0.7× their entrance. Anchored on Material's 195/225 (0.87)
     and pushed harder because an exiting element isn't read. */
  --dur-fast-out: 85ms;
  --dur-base-out: 125ms;
  --dur-slow-out: 195ms;
  --dur-page-out: 295ms;
}
```

`--dur-base: 180ms` sits between Carbon's 150 and Material's desktop 150–200 and
below Material's mobile 300 — this is a desktop-first, dense, image-heavy site, so
the desktop end of the range is right.

### 9.3 Spring presets

```ts
// lib/motion.ts
export const spring = {
  /** Grid card ⇄ lightbox layoutId morph. Zero bounce: the destination
   *  bounds must match the real element, and it carries text and images. */
  morph:   { type: "spring", visualDuration: 0.45, bounce: 0 },

  /** Modal, sheet, admin drawer. Enough bounce to read as arriving. */
  sheet:   { type: "spring", visualDuration: 0.35, bounce: 0.15 },

  /** Nav bar show/hide, music-player pill expand. */
  chrome:  { type: "spring", visualDuration: 0.28, bounce: 0.1 },

  /** Toggle knob, like/save, small state flips. */
  toggle:  { type: "spring", visualDuration: 0.2, bounce: 0.25 },

  /** Drag release in the studio. PHYSICS PARAMS ON PURPOSE — the
   *  duration/bounce form discards inherited velocity (§3.3). ζ = 0.875. */
  release: { type: "spring", stiffness: 400, damping: 35, mass: 1 },

  /** Scroll-linked smoothing. Overdamped (ζ = 1.37): never overshoots,
   *  which matters because a scroll-linked value overshooting means
   *  scrolling past content the user hasn't scrolled to. */
  scroll:  { type: "spring", stiffness: 120, damping: 30, restDelta: 0.001 },
} as const

export const tween = {
  /** Exits. Bezier, not spring — AnimatePresence needs a known end time. */
  exit:    { duration: 0.195, ease: [0.2, 0, 1, 0.9] },
  fade:    { duration: 0.18,  ease: [0, 0, 0.38, 0.9] },
  backdrop:{ duration: 0.4,   ease: "linear" },
} as const

/** Cap at 8 items / 240ms — past that the stagger is latency, not rhythm. */
export const gridStagger = (i: number) => Math.min(i * 0.03, 0.24)

/** Frame-rate-independent damping, half-life parameterised (§4.2).
 *  dt in seconds; clamp it before calling. */
export const dampHalfLife = (current: number, target: number, halfLife: number, dt: number) =>
  target + (current - target) * Math.pow(2, -dt / halfLife)
```

### 9.4 Per-feature assignment

| Feature | Config |
| --- | --- |
| Masonry card hover (scale/overlay) | `--dur-instant` / `--ease-entrance`, `transform` + `opacity` only |
| Card → lightbox morph | `layoutId` + `spring.morph`, `layout="preserve-aspect"`, `borderRadius` **inline** |
| Lightbox chrome | fade in at `delay: 0.18`, `--dur-base`; out first on close at `--dur-fast-out` |
| Lightbox backdrop | `tween.backdrop` |
| Lightbox close | `AnimatePresence mode="wait"` |
| Shot delete in feed/studio | `AnimatePresence mode="popLayout"` so the grid closes up immediately |
| Feed entrance stagger | `gridStagger`, viewport items only |
| Scroll-hiding nav | `useVelocity(scrollY)` → `useSpring({stiffness: 400, damping: 90})` → 120 px/s deadband; transform with `spring.chrome` |
| Hover-to-play video | 100 ms hover-intent debounce, mount `<video>` on intent, catch the `play()` rejection |
| Music player pill | `spring.chrome`; progress bar `transform: scaleX` driven by a motion value, never `width` |
| Studio drag | `spring.release` on drop; `layout` on siblings; `mode="popLayout"` |
| Reduced motion | `<MotionConfig reducedMotion="user">` + the CSS block in §7.3 + parallax and hover-video autoplay off |

### 9.5 The three rules that matter most

1. **`transform` and `opacity` only.** Everything else is a decision that needs
   justifying against a 10 ms budget.
2. **`bounce: 0` on anything that has to land somewhere specific.** Morphs,
   grid slots, nav docking. Bounce is for things that only have to *arrive*.
3. **Exits are shorter and use a bezier.** Nobody reads a leaving element, and
   `AnimatePresence` needs to know when it is done.

---

## Appendix — quick reference: Motion v13.1.1 shipped constants

All read from `node_modules/`, line numbers against `motion-dom.dev.js` unless noted.

```
springDefaults (765)     stiffness 100 · damping 10 · mass 1 · velocity 0
                         duration 800ms · bounce 0.3 · visualDuration 0.3s
                         restSpeed {granular 0.01, default 2}
                         restDelta {granular 0.005, default 0.5}
                         minDuration 0.01s · maxDuration 10s · damping ratio clamped [0.05, 1]

bounce → ζ (806)         dampingRatio = 1 - bounce
visualDuration (894)     root = 2π/(vd*1.2); k = root²; c = 2·clamp(0.05,1,1-bounce)·√k; m = 1
override order (885)     stiffness/damping/mass  >  duration/bounce
velocity (889)           duration-based springs FORCE velocity = 0 on interruption

default tween (3210)     duration 0.3s, ease [0.25, 0.1, 0.35, 1]
default >2 keyframes     duration 0.8s
default transforms(3192) underDamped   k 500, c 25, restSpeed 10   (ζ ≈ 0.56)
default scale   (3198)   critDamped    k 550, c 30 (2√550 if target 0)
default layout  (10326)  tween, duration 0.45s, ease [0.4, 0, 0.1, 1]
inertia defaults         power 0.8 · timeConstant 700 · bounceStiffness 500 · bounceDamping 10

named easings (motion-utils.dev.js:235-251, motion-dom.dev.js:2067-2077)
  easeIn      cubic-bezier(0.42, 0,    1,    1)
  easeOut     cubic-bezier(0,    0,    0.58, 1)
  easeInOut   cubic-bezier(0.42, 0,    0.58, 1)
  circIn      cubic-bezier(0,    0.65, 0.55, 1)
  circOut     cubic-bezier(0.55, 0,    1,    0.45)
  backIn      = reverse(backOut)
  backOut     cubic-bezier(0.33, 1.53, 0.69, 0.99)
  anticipate  = mirror(backIn)

acceleratedValues (framer-motion.dev.js:2857)
  opacity · clipPath · filter · transform · backgroundColor

layout prop (index.d.ts:898)
  boolean | "position" | "size" | "preserve-aspect" | "x" | "y"
ReducedMotionConfig (framer-motion/index.d.ts:208)
  "always" | "never" | "user"
per-transition (index.d.ts:2345)
  reduceMotion?: boolean   // true = skip transform/layout, undefined = device pref
```

**Also new in v13.1.1 and not covered above:** the package ships a View
Transitions morph API (`ViewTransitionTarget` with `layout` / `enter` / `exit` /
`new` / `old` targets and an `interrupt: "wait" | "immediate"` option,
`index.d.ts:3935–4060`). It is a genuine alternative to `layoutId` for
cross-route morphs in Next's App Router and is worth a separate investigation
before the lightbox is finalised — it was out of scope here.
