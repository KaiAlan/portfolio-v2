'use client'

import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Measures an element's width and keeps it current through resizes.
 *
 * useLayoutEffect, not useEffect: the masonry needs the width before the
 * browser paints, otherwise the grid is briefly visible unpositioned.
 */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    setWidth(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0
      // Ignore sub-pixel jitter; relayout is cheap but not free.
      setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
