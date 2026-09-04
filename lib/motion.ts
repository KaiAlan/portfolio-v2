/** Shared motion presets.
 *
 *  The rules these follow are in `docs/MOTION.md`; the sourced research behind
 *  every number is `docs/superpowers/research/2026-09-04-motion-design.md`,
 *  read against the installed motion@13.1.1 rather than the docs site (they
 *  disagree — the shipped spring defaults are not the documented ones).
 *
 *  Two things worth knowing before editing anything here.
 *
 *  **Prefer `visualDuration` + `bounce` over stiffness/damping/mass.** `bounce`
 *  maps exactly onto the damping ratio as `ζ = 1 - bounce`, and
 *  `visualDuration` is the time to first *reach* the target rather than to
 *  fully settle — which is the thing you can actually judge by eye. Tuning a
 *  spring by stiffness is guessing at a number nobody perceives directly.
 *
 *  **But a duration-parameterised spring throws away velocity when
 *  interrupted.** `motion-dom.dev.js:889` forces `velocity = 0` for any spring
 *  defined by duration/bounce/visualDuration; only stiffness/damping springs
 *  inherit it. That inverts the usual advice — the ergonomic form is the one
 *  that discards the thing springs exist for — so anything gesture-driven or
 *  interruptible has to use physics params. `release` and `scroll` below are
 *  the two that do, and that is why they look different from their neighbours.
 */

export const spring = {
  /** The grid card ⇄ lightbox `layoutId` morph.
   *
   *  `bounce: 0` is not a taste call. Overshoot means the media leaves the
   *  bounds it is morphing into and comes back, and the illusion that this is
   *  the *same object* breaks the moment it overshoots its own destination.
   *
   *  Both ends of a morph must use this same object. Two different curves
   *  interpolated against each other visibly hitch — including a parent's
   *  `layout` against its own child's `layoutId`, which is how this site had
   *  it until 2026-09-04.
   *
   *  0.2s, NOT the ~0.45s that general guidance recommends for a morph this
   *  size. The hand-tuned spring this replaces (k 460, c 42, m 0.8) works out
   *  to ζ = 1.095 and a ~152ms settle, tuned against cosmos.so, which is a
   *  fast site. `visualDuration: 0.2, bounce: 0` reproduces that at ~153ms —
   *  so this is the same feel expressed in the parameterisation you can
   *  actually reason about, not a retune. 0.45 would be two and a half times
   *  slower and would lose the thing the reference was chosen for. */
  morph: { type: 'spring', visualDuration: 0.2, bounce: 0 },

  /** Modals, sheets, the studio's drawers. Enough bounce to read as arriving
   *  rather than as appearing. */
  sheet: { type: 'spring', visualDuration: 0.35, bounce: 0.15 },

  /** Chrome that docks: the scroll-hiding nav, the music pill. Barely bounces
   *  — chrome that wobbles when it parks reads as unstable. */
  chrome: { type: 'spring', visualDuration: 0.28, bounce: 0.1 },

  /** Small state flips where the bounce IS the feedback. */
  toggle: { type: 'spring', visualDuration: 0.2, bounce: 0.25 },

  /** Drag release in the studio. Physics params ON PURPOSE — see the header:
   *  the duration/bounce form would discard the throw velocity, which is the
   *  only interesting thing about a release. ζ = 0.875, so it settles without
   *  overshooting a grid slot. */
  release: { type: 'spring', stiffness: 400, damping: 35, mass: 1 },

  /** Scroll-linked smoothing. Overdamped (ζ ≈ 1.37) and physics-parameterised
   *  for the same velocity reason. A scroll-linked value that overshoots is
   *  showing content the user has not scrolled to, which is worse than lag. */
  scroll: { type: 'spring', stiffness: 120, damping: 30, restDelta: 0.001 },
} as const

export const tween = {
  /** Exits. A bezier, not a spring: nobody reads a leaving element, and
   *  `AnimatePresence` needs a known end time to unmount on. */
  exit: { duration: 0.195, ease: [0.2, 0, 1, 0.9] },
  /** The general-purpose fade-in. Matches `--dur-base` / `--ease-entrance`. */
  fade: { duration: 0.18, ease: [0, 0, 0.38, 0.9] },
  /** The exit half of `fade`, for popovers and dropdowns — 0.7x, per the
   *  scale. `exit` above is for panels, which are larger and need longer. */
  popoverOut: { duration: 0.125, ease: [0.2, 0, 1, 0.9] },
  /** The lightbox backdrop.
   *
   *  Deliberately fast, and deliberately NOT the ~400ms wash that general
   *  motion guidance would suggest for a backdrop. This site's reference
   *  (cosmos.so) has the feed already blurred on the frame after the click:
   *  the blur is the context switch, and it lands *before* the morph rather
   *  than tracking it, so the morph is unambiguously the subject.
   *
   *  Raising this to 400ms makes the blur and the morph two co-equal events
   *  competing for the eye, which is the thing choreography is meant to
   *  avoid. It was 0.12s/easeOut before the token pass and stays there — this
   *  is a design decision, not an unconsidered number. */
  backdrop: { duration: 0.12, ease: [0, 0, 0.38, 0.9] },
} as const

/** Delay for the nth item of a staggered grid, in seconds.
 *
 *  Capped at 8 items / 240ms deliberately. Past that a stagger stops being
 *  rhythm and becomes latency: the user does not perceive "choreography", they
 *  perceive the last card taking two seconds to show up. */
export const gridStagger = (index: number) => Math.min(index * 0.03, 0.24)

/** Frame-rate-independent exponential damping.
 *
 *  The pattern everyone writes — `current += (target - current) * 0.1` — is
 *  wrong, because it applies once per *frame* rather than per unit of time. It
 *  therefore runs 2.4x faster on a 144Hz display than on a 60Hz one. The same
 *  bug appears in anything that advances state "per frame", which is why the
 *  studio's drag auto-scroll used to be measured in pixels per frame.
 *
 *  `halfLife` is the time for the remaining distance to halve — a directly
 *  meaningful number, unlike a per-frame coefficient. `dt` is in seconds and
 *  must be CLAMPED by the caller: a backgrounded tab returns a dt of several
 *  seconds on its first frame back and would teleport the value.
 *
 *  In React, prefer Motion's own `useSpring` over a motion value — it is
 *  already frame-rate correct. This is for the raw rAF loops that aren't. */
export const dampHalfLife = (
  current: number,
  target: number,
  halfLife: number,
  dt: number,
) => target + (current - target) * Math.pow(2, -dt / halfLife)

/** Milliseconds to hold a route or element open while a `spring` finishes.
 *
 *  `visualDuration` is time-to-target, not time-to-rest, so anything that has
 *  to outlast the settle needs headroom on top of it. Deriving it here means a
 *  retune of `spring.morph` carries automatically instead of silently
 *  desyncing a hardcoded timeout somewhere else — which is exactly what the
 *  lightbox's old `CLOSE_MS = 300` was waiting to do.
 *
 *  1.4x is not arbitrary: at `spring.morph` it yields 280ms, which is also
 *  `--dur-slow`, the panel slide that runs alongside the morph on close. Both
 *  halves of the close therefore land together and the route changes on the
 *  frame after. If you change `--dur-slow`, check this still covers it. */
export const settleMs = (visualDuration: number) => Math.round(visualDuration * 1000 * 1.4)
