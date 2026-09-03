'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BACKDROP_FADE } from '@/lib/motion'
import { LightboxContext, acquireLightbox, releaseLightbox } from './lightbox-context'

/**
 * The lightbox shell for an intercepted /work/[slug].
 *
 * Close is router.back(), not a push to "/": the grid is the previous history
 * entry, so going back restores its scroll position and active filter for
 * free. Prev/next replace the entry instead of pushing, so a long browse
 * doesn't bury the grid under twenty history states.
 *
 * Closing is deliberately two-phase. router.back() unmounts this route
 * synchronously, which would kill the morph before it could run, so instead
 * `open` flips false and the children react to it: the media unmounts, which
 * hands the shared layoutId back to the grid card so it can animate home,
 * while the panel slides out and the backdrop fades. Only then does the
 * router actually navigate.
 *
 * The shell renders no chrome of its own — the controls live inside the
 * detail panel and reach these callbacks through LightboxContext.
 */

/** Matches the morph and the panel slide. Long enough for both to land, short
 *  enough that the URL is never visibly out of step with the screen. */
const CLOSE_MS = 300

type LightboxProps = {
  prevHref: string | null
  nextHref: string | null
  children: ReactNode
}

const Lightbox = ({ prevHref, nextHref, children }: LightboxProps) => {
  const router = useRouter()
  const touchStartX = useRef<number | null>(null)
  // One state machine rather than an `open` flag beside a "have I navigated
  // yet" ref: the two always had to agree, and keeping them separate meant
  // mutating a ref during render to resync them.
  //
  //   open    -> on screen
  //   closing -> animating out; the media has already unmounted so the grid
  //              card can morph home, and router.back() is pending
  //   gone    -> back() has fired; never fire it twice, or history walks past
  //              the feed and off the site entirely
  const [phase, setPhase] = useState<'open' | 'closing' | 'gone'>('open')
  const open = phase === 'open'

  const close = useCallback(() => setPhase('closing'), [])

  // Re-arm when this route becomes active again.
  //
  // Closing leaves the machine in `gone`. If Next keeps the modal slot mounted
  // rather than tearing it down — which it does when the same URL is re-entered
  // from its client cache — that stale phase survives, and clicking the SAME
  // card again renders a lightbox that is already closed: panel off-screen,
  // media unmounted, nothing visible. Resetting on the pathname makes a reopen
  // behave like a first open. Adjusting state during render (rather than in an
  // effect) is React's own pattern for this and avoids a wasted second pass.
  const pathname = usePathname()
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (pathname?.startsWith('/work/')) setPhase('open')
  }

  const go = useCallback(
    (href: string | null) => {
      if (href) router.replace(href, { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    if (phase !== 'closing') return
    const timer = setTimeout(() => {
      setPhase('gone')
      router.back()
    }, CLOSE_MS)
    return () => clearTimeout(timer)
  }, [phase, router])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowLeft') go(prevHref)
      else if (event.key === 'ArrowRight') go(nextHref)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, go, prevHref, nextHref])

  // Registers this lightbox as on-screen so the detail panel can tell an
  // arrow-key switch (previous instance still mounted) from a fresh open.
  useEffect(() => {
    acquireLightbox()
    return () => releaseLightbox()
  }, [])

  // No body scroll lock. Setting overflow:hidden on <body> overrides the
  // stylesheet's overflow-x:clip with `hidden` on BOTH axes, which makes body
  // a scroll container and breaks every position:sticky on the page — the
  // navbar then sticks to the top of the body box, above the viewport, and
  // disappears. The overlay already covers the viewport and carries
  // overscroll-contain, so scroll cannot chain to the feed anyway.

  const controls = useMemo(
    () => ({
      close,
      goPrev: () => go(prevHref),
      goNext: () => go(nextHref),
      hasPrev: prevHref !== null,
      hasNext: nextHref !== null,
      open,
    }),
    [close, go, prevHref, nextHref, open],
  )

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return

    const delta = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(delta) < 60) return
    go(delta > 0 ? prevHref : nextHref)
  }

  return (
    <LightboxContext.Provider value={controls}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            // Acrylic, not a scrim: the feed stays legible as blurred colour
            // behind the shot. Low tint + heavy blur is what reads as frosted
            // glass — raising the tint instead just looks like fog.
            className="pointer-events-none fixed inset-0 z-100 bg-canvas/55 backdrop-blur-2xl backdrop-saturate-150"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={BACKDROP_FADE}
          />
        )}
      </AnimatePresence>

      <div
        // Covers the navbar deliberately: the lightbox is its own context.
        // Inert once closing starts, because an invisible overlay left lying
        // across the viewport swallows every click on the feed underneath.
        className={`fixed inset-0 z-100 overflow-y-auto overscroll-contain lg:overflow-hidden ${
          open ? '' : 'pointer-events-none'
        }`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </LightboxContext.Provider>
  )
}

export default Lightbox
