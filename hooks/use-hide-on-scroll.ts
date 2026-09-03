'use client'

import { useEffect, useState } from 'react'

/**
 * Hide a bar on scroll down, bring it back on scroll up.
 *
 * The reveal is deliberately not instant. Reacting to a single upward pixel
 * makes the bar twitch in and out during ordinary trackpad drift, so upward
 * movement has to accumulate past `revealAfter` before it counts — and any
 * downward movement resets that accumulation, so a genuine change of direction
 * is required rather than jitter.
 *
 * Edge cases handled:
 *   - Near the top the bar is always shown, whatever the direction.
 *   - Scroll position is clamped, so rubber-band overscroll on macOS and iOS
 *     (which reports negative offsets and offsets past the end) cannot flip it.
 *   - Sub-pixel and momentum-tail deltas below `MIN_DELTA` are ignored.
 *   - A page too short to scroll never hides it, since `y` stays below `after`.
 *   - Reads are batched into a rAF so a fast scroll does one measurement per
 *     frame instead of one per event.
 */

/** Below this, a delta is noise — momentum tails and sub-pixel drift. */
const MIN_DELTA = 4

type Options = {
  /** Stay visible until scrolled at least this far down. */
  after?: number
  /** Cumulative upward travel required to bring it back. */
  revealAfter?: number
}

export function useHideOnScroll({ after = 120, revealAfter = 60 }: Options = {}) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    let upwardTravel = 0
    let queued = false

    const measure = () => {
      queued = false

      const limit = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0,
      )
      const y = Math.min(Math.max(window.scrollY, 0), limit)
      const delta = y - lastY

      if (Math.abs(delta) < MIN_DELTA) return
      lastY = y

      // Anywhere near the top the bar belongs on screen, and any pending
      // upward travel is irrelevant.
      if (y <= after) {
        upwardTravel = 0
        setHidden(false)
        return
      }

      if (delta > 0) {
        upwardTravel = 0
        setHidden(true)
        return
      }

      upwardTravel += -delta
      if (upwardTravel >= revealAfter) {
        upwardTravel = 0
        setHidden(false)
      }
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(measure)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [after, revealAfter])

  return hidden
}
