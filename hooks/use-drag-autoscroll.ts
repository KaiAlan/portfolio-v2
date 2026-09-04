'use client'

import { useEffect, useRef } from 'react'

/**
 * Scrolls the studio panel while a native drag hovers near its edges.
 *
 * Native HTML5 drag-and-drop does not reliably auto-scroll a nested scroll
 * container — the browser only does it for the document in some engines — so
 * a card could not be dragged anywhere that wasn't already on screen. On a
 * board of thirty tiles that makes the bottom half unreachable.
 *
 * Speed ramps with proximity rather than switching on at a threshold: a
 * constant-speed edge zone either crawls when you want to cross the board or
 * overshoots when you want the next row.
 *
 * `dragover` on the window, not the container: during a drag the events fire
 * against whatever is under the pointer, and once the pointer leaves the
 * cards — which is exactly when scrolling matters — a container listener
 * stops hearing about it.
 */

/** How close to an edge, in px, before scrolling starts. */
const EDGE = 110

/** Fastest scroll in px per SECOND, reached at the very edge.
 *
 *  Per second, not per frame. This was 22px/frame, which is frame-rate
 *  dependent and therefore a different feature on different hardware: 1320px/s
 *  on a 60Hz panel, 2640px/s at 120Hz, 3168px/s at 144Hz. The same board
 *  scrolled two and a half times faster on a gaming monitor than on a laptop.
 *
 *  1320 keeps the 60Hz feel everyone tuned against and makes every other
 *  refresh rate match it. See docs/MOTION.md, "Frame-rate independence". */
const MAX_SPEED = 1320

/** Longest frame delta to trust, in seconds.
 *
 *  A backgrounded tab resumes with a dt of several seconds, and a velocity
 *  multiplied by that jumps the panel to the end in one frame. Clamping to
 *  ~4 frames at 60Hz means a stutter loses a little travel instead. */
const MAX_DT = 1 / 15

export function useDragAutoScroll(active: boolean) {
  const velocity = useRef(0)

  useEffect(() => {
    if (!active) return

    const scroller = document.querySelector<HTMLElement>('[data-studio-scroll]')
    if (!scroller) return

    // rAF hands each callback the frame's timestamp; the delta between two of
    // them is the only honest measure of how much time the scroll should
    // account for. `last` starts null so the first frame moves nothing rather
    // than integrating against an arbitrary origin.
    let last: number | null = null

    let frame = requestAnimationFrame(function step(now: number) {
      const dt = last === null ? 0 : Math.min((now - last) / 1000, MAX_DT)
      last = now

      if (velocity.current !== 0 && dt > 0) scroller.scrollTop += velocity.current * dt
      frame = requestAnimationFrame(step)
    })

    const onDragOver = (event: DragEvent) => {
      const box = scroller.getBoundingClientRect()
      const fromTop = event.clientY - box.top
      const fromBottom = box.bottom - event.clientY

      if (fromTop < EDGE) {
        velocity.current = -MAX_SPEED * (1 - Math.max(fromTop, 0) / EDGE)
      } else if (fromBottom < EDGE) {
        velocity.current = MAX_SPEED * (1 - Math.max(fromBottom, 0) / EDGE)
      } else {
        velocity.current = 0
      }
    }

    window.addEventListener('dragover', onDragOver)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      cancelAnimationFrame(frame)
      velocity.current = 0
    }
  }, [active])
}
