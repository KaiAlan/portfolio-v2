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
/** Fastest scroll in px per frame, reached at the very edge. */
const MAX_SPEED = 22

export function useDragAutoScroll(active: boolean) {
  const velocity = useRef(0)

  useEffect(() => {
    if (!active) return

    const scroller = document.querySelector<HTMLElement>('[data-studio-scroll]')
    if (!scroller) return

    let frame = requestAnimationFrame(function step() {
      if (velocity.current !== 0) scroller.scrollTop += velocity.current
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
